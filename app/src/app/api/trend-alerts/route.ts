import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { A2AClient, SendMessageSuccessResponse } from "@a2a-js/sdk";
import {
  FALLBACK_NOTIFICATIONS,
  buildCoachPrompt,
  TrendAlertsPayload,
  TrendNotification,
} from "@/app/dashboard/trend-alerts-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/*  GET /api/trend-alerts — daily trend feed for the Bell notification panel.
    Calls the Python Researcher Agent (agents/researcher/agent.py) over A2A
    and asks it to return a strict JSON payload describing 4 emerging
    trends with platform, region, a short description, and concrete
    steps-to-join the creator can act on this week.

    Response shape:
      {
        "source": "live" | "sample",
        "generatedAt": "2026-04-19T10:13:00.000Z",
        "notifications": TrendNotification[],
        "reason"?: string  // present when source === "sample"
      }

    Resilience:
      • Researcher offline / non-JSON reply / timeout → returns the
        FALLBACK_NOTIFICATIONS sample set so the UI stays demo-able.
      • Successful replies are cached in-memory for 6h — these are
        "daily" alerts and each call is a Gemini round-trip.

    Phase-2 hook: the Creator / Learner agents can later feed into the
    same endpoint (each contributing its own notification stream). For
    now Researcher is the single source. */

export const dynamic = "force-dynamic";

const RESEARCHER_URL =
  process.env.RESEARCHER_URL ||
  `http://127.0.0.1:${process.env.RESEARCHER_PORT || "9993"}`;

// 6h — daily-ish alerts, and each call is a Gemini round-trip. Survives
// route-module reloads in prod but not restarts; good enough for Phase 2.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; payload: TrendAlertsPayload } | null = null;

// Creator context the Researcher uses to ground its trend picks. When we
// wire real auth + creator profiles, pull this from Supabase instead.
const CREATOR_CONTEXT = [
  "Creator: Emma Matlhaga",
  "Niche: founder / social-media-strategy / South African creator economy",
  "Primary platforms: TikTok, Instagram Reels",
  "Secondary: YouTube Shorts, X (Twitter)",
  "Location: Johannesburg, South Africa",
].join("\n");

const RESEARCHER_PROMPT = `You are being invoked in "daily alert" mode.
Ignore your default TREND REPORT / save_trend_report flow for this turn.
Do NOT call any tools. Do NOT include prose before or after the JSON.

Return ONLY a valid JSON object with this exact shape:

{
  "notifications": [
    {
      "trend": "<short name of the trend>",
      "platform": "<TikTok | Instagram Reels | YouTube Shorts | X | mixed>",
      "region": "<geographic scope — be specific: city, country, or global>",
      "about": "<1-2 sentences on what the trend looks like and why it is currently working>",
      "how_to_join": "<2-3 sentences — concrete steps the creator should take this week to ride this trend and gain followers>",
      "time_ago": "<human-readable freshness, e.g. '2h ago', '5h ago', 'Yesterday', 'Today'>",
      "score": <integer 0-100 viral_potential_score>
    }
  ]
}

Rules:
- Return exactly 4 notifications.
- Rank by viral_potential_score, highest first.
- Only include trends the creator below can AUTHENTICALLY ride (natural-fit >= 60).
- Keep each "about" and "how_to_join" concrete — no vague marketing copy.
- Do not invent statistics; if you cite a number, phrase it as an estimate.

Creator context:
${CREATOR_CONTEXT}`;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "trend";
}

// Researcher response is raw text — the JSON we want is either the whole
// body or embedded inside a ```json fence. Pull the first balanced {…}.
function extractJson(text: string): string | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (inner.startsWith("{") && inner.endsWith("}")) return inner;
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1);
}

interface RawNotification {
  trend?: unknown;
  platform?: unknown;
  region?: unknown;
  about?: unknown;
  how_to_join?: unknown;
  time_ago?: unknown;
  score?: unknown;
}

function shape(raw: RawNotification, index: number): TrendNotification | null {
  const trend = typeof raw.trend === "string" ? raw.trend.trim() : "";
  const platform = typeof raw.platform === "string" ? raw.platform.trim() : "";
  const region = typeof raw.region === "string" ? raw.region.trim() : "";
  const about = typeof raw.about === "string" ? raw.about.trim() : "";
  const howToJoin =
    typeof raw.how_to_join === "string" ? raw.how_to_join.trim() : "";
  if (!trend || !about || !howToJoin) return null;

  return {
    id: `n-live-${index}-${slugify(trend)}`,
    agent: "coaching",
    agentLabel: "Content Coach",
    time: typeof raw.time_ago === "string" ? raw.time_ago : "Today",
    trend,
    platform: platform || "Mixed",
    region: region || "Global",
    about,
    howToJoin,
    score: typeof raw.score === "number" ? raw.score : undefined,
  };
}

function parseResearcherReply(reply: string): TrendNotification[] | null {
  const json = extractJson(reply);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const list =
    parsed && typeof parsed === "object" && "notifications" in parsed
      ? (parsed as { notifications?: unknown }).notifications
      : null;
  if (!Array.isArray(list)) return null;
  const shaped = list
    .map((n, i) => shape(n as RawNotification, i))
    .filter((n): n is TrendNotification => n !== null);
  return shaped.length ? shaped : null;
}

async function callResearcher(): Promise<TrendNotification[]> {
  const client = new A2AClient(RESEARCHER_URL);
  const send = await client.sendMessage({
    message: {
      kind: "message",
      messageId: randomUUID(),
      role: "user",
      parts: [{ text: RESEARCHER_PROMPT, kind: "text" }],
    },
  });

  if ("error" in send) {
    const detail =
      (send as { error: { message?: string } }).error?.message ??
      "Researcher agent returned an error";
    throw new Error(detail);
  }

  const result = (send as SendMessageSuccessResponse).result;
  if (
    result.kind !== "message" ||
    result.parts.length === 0 ||
    result.parts[0].kind !== "text"
  ) {
    throw new Error("Researcher returned an unexpected payload");
  }
  const reply = result.parts[0].text;
  const shaped = parseResearcherReply(reply);
  if (!shaped) throw new Error("Couldn't parse trend JSON from Researcher");
  return shaped;
}

function sampleResponse(reason: string): TrendAlertsPayload {
  return {
    source: "sample",
    generatedAt: new Date().toISOString(),
    notifications: FALLBACK_NOTIFICATIONS,
    reason,
  };
}

/**
 * Persist each Researcher-produced trend as a row in the notifications
 * table so the bell badge + scrollable feed populate from real data.
 *
 * Scoped to the currently-authenticated user — when the route fires
 * without a session we silently skip the write (the trend list still
 * returns to the UI). Uses the service-role client to bypass RLS on
 * INSERT, since RLS only allows authenticated users to SELECT/UPDATE
 * their own rows.
 *
 * Best-effort: we never fail the user-facing response on a DB blip.
 */
async function persistAsNotifications(notifications: TrendNotification[]) {
  if (!notifications.length) return;

  // Need the user's email to scope ownership. The route is hit from the
  // dashboard so a session usually exists — when it doesn't (e.g. dev
  // ping without auth), skip the write.
  let uploader: string | null = null;
  try {
    const sb = await createSupabaseServerClient();
    const { data: auth } = await sb.auth.getUser();
    uploader = auth.user?.email ?? null;
  } catch {
    /* no session — skip */
  }
  if (!uploader) return;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return; // service-role env vars missing — can't write, that's fine
  }

  const rows = notifications.map((n) => ({
    uploader,
    category: "trend" as const,
    title: n.trend,
    body: n.about,
    chat_prompt: buildCoachPrompt(n),
    meta: {
      source_agent: "researcher",
      platform: n.platform,
      region: n.region,
      score: n.score ?? null,
      time_label: n.time,
      how_to_join: n.howToJoin,
    },
  }));

  try {
    // Cast — admin client has no generated Database type, so insert()
    // is typed as never[]. Generate types via `supabase gen types` and
    // remove this cast once we land typed schemas.
    await admin.from("notifications").insert(rows as never);
  } catch {
    /* DB unavailable — never block the trend feed on persistence */
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("refresh") === "1";

  let payload: TrendAlertsPayload;

  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    // Cache hit: we re-use the Researcher's payload to avoid a Gemini
    // round-trip, but we still persist for the current user — each user
    // needs their own rows in public.notifications, and a global cache
    // would otherwise mean only the first caller per 6h window gets
    // persisted.
    payload = cache.payload;
  } else {
    try {
      const notifications = await callResearcher();
      payload = {
        source: "live",
        generatedAt: new Date().toISOString(),
        notifications,
      };
      cache = { at: Date.now(), payload };
    } catch (err) {
      const reason =
        err instanceof Error
          ? err.message
          : "Couldn't reach the Researcher agent";
      // Don't cache the sample fallback — we want the next request to
      // retry the live agent as soon as it comes back up.
      return NextResponse.json(sampleResponse(reason));
    }
  }

  // Always persist the current user's copy — best-effort, scoped to the
  // signed-in account via createSupabaseServerClient inside the helper.
  await persistAsNotifications(payload.notifications);
  return NextResponse.json(payload);
}
