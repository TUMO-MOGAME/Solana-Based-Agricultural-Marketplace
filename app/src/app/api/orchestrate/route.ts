import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/orchestrate
 *
 * Body: { intent?: 'manual'|'event_journey'|'trend_plan'|...,
 *          input: string,
 *          seed?: object }
 *
 * Creates a pipeline_runs row, returns its id immediately, and spawns
 * a Python subprocess that runs the orchestrator. The subprocess updates
 * the same row as each LangGraph node completes — the dashboard polls
 * GET /api/orchestrate/[id] to render live progress.
 *
 * Why a subprocess + DB-polling instead of streaming?
 *   • Pipeline runs take 5–15 minutes — no HTTP request can stay open
 *     that long behind Vercel/proxy timeouts.
 *   • Polling the DB lets the UI tolerate page refreshes / dropped
 *     connections without losing state.
 */

const ALLOWED_INTENTS = new Set([
  "manual",
  "event_journey",
  "trend_plan",
  "onboarding",
  "stage_refresh",
]);

// Cooldown to stop accidental double-clicks from queueing two heavy runs.
const COOLDOWN_SEC = 5 * 60;
// Per-day cap so a stuck UI loop can't rack up cost.
const MAX_RUNS_PER_DAY = 5;

export async function POST(req: NextRequest) {
  // Auth: derive uploader from the cookie session — never trust the
  // client to claim an identity here.
  const sb = await createSupabaseServerClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user?.email) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const uploader = auth.user.email;

  let body: { intent?: string; input?: string; seed?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "expected JSON body" }, { status: 400 });
  }

  const intent =
    typeof body.intent === "string" && ALLOWED_INTENTS.has(body.intent)
      ? body.intent
      : "manual";
  const input =
    typeof body.input === "string" && body.input.trim()
      ? body.input.trim()
      : "Draft a piece of short-form content for me.";

  const admin = createSupabaseAdminClient();

  // Rate-limit + cooldown checks (best-effort).
  const sinceCooldown = new Date(Date.now() - COOLDOWN_SEC * 1000).toISOString();
  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const recent = await admin
      .from("pipeline_runs")
      .select("id, started_at, created_at")
      .eq("uploader", uploader)
      .gte("created_at", sinceCooldown)
      .limit(1);
    if (recent.data && recent.data.length > 0) {
      return NextResponse.json(
        { error: `cooldown — wait ~${COOLDOWN_SEC / 60} min before kicking off another run` },
        { status: 429 },
      );
    }

    const dayCount = await admin
      .from("pipeline_runs")
      .select("id", { count: "exact", head: true })
      .eq("uploader", uploader)
      .gte("created_at", sinceDay);
    if ((dayCount.count ?? 0) >= MAX_RUNS_PER_DAY) {
      return NextResponse.json(
        { error: `daily cap reached (${MAX_RUNS_PER_DAY} runs/day)` },
        { status: 429 },
      );
    }
  } catch {
    // Don't block on the limit-check failing — the user's run still kicks off.
  }

  // Insert the pipeline_runs row.
  const insert = await admin
    .from("pipeline_runs")
    .insert({
      uploader,
      intent,
      seed_input: body.seed ?? {},
      user_input: input,
      status: "pending",
      stages: [],
    } as never)
    .select()
    .single();

  // Without generated Database types the .data field is typed as `never`,
  // so cast the whole envelope to surface the inserted id.
  const insertData = insert.data as { id: string } | null;
  if (insert.error || !insertData) {
    return NextResponse.json(
      { error: insert.error?.message ?? "Failed to create pipeline_runs row" },
      { status: 500 },
    );
  }
  const runId = insertData.id;

  // Spawn the orchestrator in a detached subprocess. We do NOT await —
  // the route returns immediately so the UI can start polling.
  const cwd = process.cwd();
  const python = process.env.PYTHON_EXECUTABLE || "python";
  const args = [
    "-m", "agents.orchestrator.cli",
    "--uploader", uploader,
    "--input", input,
    "--run-id", runId,
  ];
  try {
    const child = spawn(python, args, {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch (err) {
    await admin
      .from("pipeline_runs")
      .update({
        status: "errored",
        error: `failed to spawn subprocess: ${err instanceof Error ? err.message : String(err)}`,
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", runId);
    return NextResponse.json({ error: "Failed to spawn orchestrator" }, { status: 500 });
  }

  return NextResponse.json({
    run_id: runId,
    status: "pending",
    message: "Pipeline started — poll GET /api/orchestrate/<id> for progress.",
  });
}

// Suppress the path-level unused export warning if any tooling complains.
export const dynamic = "force-dynamic";
