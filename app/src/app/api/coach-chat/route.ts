import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { A2AClient, SendMessageSuccessResponse } from "@a2a-js/sdk";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*  POST /api/coach-chat — bridges the /dashboard Gemini-style chat to the
    Python A2A Content Coaching Agent (see agents/coaching/agent.py). The
    agent runs locally on COACHING_PORT (default 9995) and speaks A2A over
    HTTP; we just forward the text prompt and return its reply.

    Uploaded media policy (per product requirement):
      • Files live on disk ONLY while the agent is analysing them.
      • As soon as the agent returns, we delete every attachment that was
        sent with the request.
      • Metadata (filename, mime, size, kind, timestamps) stays — the
        agent's `save_coaching_session` tool writes it to Supabase, and
        the frontend persists a lightweight copy in the session thread.

    If the coaching agent isn't running we return 503 with a friendly
    message so the UI can prompt the user to start it. */

const COACHING_URL =
  process.env.COACHING_URL ||
  `http://127.0.0.1:${process.env.COACHING_PORT || "9995"}`;

type ChatRole = "user" | "model";

interface IncomingAttachment {
  storedName: string; // the server-assigned filename under tmp/uploads/
  url: string;        // absolute URL agents can fetch (served by /api/media)
  kind: "image" | "video";
  filename?: string;  // original name the user uploaded as
  mime?: string;
  size?: number;
}

interface IncomingMessage {
  role: ChatRole;
  content: string;
}

function buildPrompt(
  messages: IncomingMessage[],
  attachments: IncomingAttachment[],
  uploader: string,
  systemHint?: string,
): string {
  // Keep the last 8 turns of history so the agent has context without
  // blowing its window. The agent's own prompt adds a lot of scaffolding.
  const history = messages.slice(-8);
  const lines: string[] = [];

  // systemHint is opt-in from the client — currently used by event-
  // journey sessions (src/app/dashboard/events-journey.ts) to tell the
  // coach which stage of the journey the user is in on every turn. It
  // is NOT part of the chat thread itself, so it never leaks back into
  // the user's visible messages.
  if (systemHint && systemHint.trim()) {
    lines.push(systemHint.trim());
    lines.push("");
  }

  for (const m of history) {
    const speaker = m.role === "user" ? "User" : "Coach";
    lines.push(`${speaker}: ${m.content}`);
  }

  // Append attachment URLs on their own lines so `extract_urls` picks them
  // up inside the Python agent. The agent's prompt normalises these into
  // Gemini vision calls.
  if (attachments.length) {
    lines.push("");
    for (const a of attachments) {
      lines.push(`[${a.kind}] ${a.url}`);
    }
  }

  // Uploader hint so `extract_uploader` doesn't fall back to "anonymous"
  // when the coach's save_coaching_session tool logs to Supabase.
  lines.push("", `uploader: ${uploader || "anonymous"}`);

  return lines.join("\n");
}

/**
 * Persist the latest user message + the agent's reply to public.chat_messages
 * so the dashboard can later replay full threads from Supabase. Best-effort:
 * never throws and never blocks the response — a Supabase blip MUST NOT
 * break the chat UI.
 *
 * Inserts two rows: one for the user, one for the model. Both share the
 * same session_id so SELECT * WHERE session_id = '...' ORDER BY created_at
 * yields the thread in order.
 */
async function persistChatTurn(args: {
  uploader: string;
  sessionId: string | null;
  sessionTitle: string | null;
  userContent: string;
  modelContent: string;
  attachments: IncomingAttachment[];
}): Promise<void> {
  if (!args.sessionId || !args.uploader || args.uploader === "anonymous") {
    // No session to group by, or no authenticated identity to scope to —
    // skip rather than write anonymous-uploader rows that nobody can see.
    return;
  }

  // Strip URLs / storedName from the persisted attachment metadata —
  // those resources are deleted right after this call.
  const attachmentsMeta = args.attachments.map((a) => ({
    kind: a.kind,
    filename: a.filename,
    mime: a.mime,
    size: a.size,
  }));

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return; // service-role env vars missing — skip silently
  }

  try {
    const now = new Date();
    const userRow = {
      uploader:      args.uploader,
      session_id:    args.sessionId,
      session_title: args.sessionTitle,
      role:          "user",
      content:       args.userContent,
      attachments:   attachmentsMeta,
      meta:          {},
      // Slight backdate so the user message is reliably ordered before the
      // model reply when both inserts arrive in the same millisecond.
      created_at:    new Date(now.getTime() - 1).toISOString(),
    };
    const modelRow = {
      uploader:      args.uploader,
      session_id:    args.sessionId,
      session_title: args.sessionTitle,
      role:          "model",
      content:       args.modelContent,
      attachments:   [],
      meta:          {},
      created_at:    now.toISOString(),
    };
    await admin.from("chat_messages").insert([userRow, modelRow] as never);
  } catch {
    /* DB unavailable — never block the chat reply on persistence */
  }
}

async function deleteAttachments(attachments: IncomingAttachment[]): Promise<void> {
  const dir = path.resolve(path.join(process.cwd(), "tmp", "uploads"));
  await Promise.all(
    attachments.map(async (a) => {
      if (!a.storedName) return;
      // Reject anything that tries to escape tmp/uploads — same defence as
      // /api/media/<filename>.
      if (a.storedName.includes("/") || a.storedName.includes("\\") || a.storedName.includes("..")) {
        return;
      }
      const target = path.resolve(path.join(dir, a.storedName));
      if (!target.startsWith(dir + path.sep)) return;
      try {
        await unlink(target);
      } catch {
        /* already gone — that's fine */
      }
    })
  );
}

export async function POST(req: NextRequest) {
  let body: {
    messages?: IncomingMessage[];
    attachments?: IncomingAttachment[];
    uploader?: string;
    systemHint?: string;
    sessionId?: string;
    sessionTitle?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  const sessionTitle = typeof body.sessionTitle === "string" ? body.sessionTitle : null;

  // Authoritative uploader source: the cookie-bound Supabase auth session.
  // We deliberately ignore body.uploader when there's a real session — that
  // way a stale frontend (or any client that misroutes the email) can't
  // cause writes to land under the wrong account. Falls back to body's
  // value only when there's no signed-in user (dev / unauthenticated test
  // pings), and finally "anonymous" as a last resort.
  let uploader = "anonymous";
  try {
    const sb = await createSupabaseServerClient();
    const { data: auth } = await sb.auth.getUser();
    if (auth.user?.email) {
      uploader = auth.user.email;
    } else if (typeof body.uploader === "string" && body.uploader) {
      uploader = body.uploader;
    }
  } catch {
    if (typeof body.uploader === "string" && body.uploader) {
      uploader = body.uploader;
    }
  }

  if (messages.length === 0) {
    return NextResponse.json(
      { error: "`messages` must be a non-empty array" },
      { status: 400 }
    );
  }

  const systemHint =
    typeof body.systemHint === "string" ? body.systemHint : undefined;
  const prompt = buildPrompt(messages, attachments, uploader, systemHint);
  const client = new A2AClient(COACHING_URL);

  let reply: string;
  try {
    const sendResponse = await client.sendMessage({
      message: {
        kind: "message",
        messageId: randomUUID(),
        role: "user",
        parts: [{ text: prompt, kind: "text" }],
      },
    });

    if ("error" in sendResponse) {
      const detail =
        (sendResponse as { error: { message?: string } }).error?.message ??
        "Coaching agent returned an error";
      await deleteAttachments(attachments);
      return NextResponse.json({ error: detail }, { status: 502 });
    }

    const result = (sendResponse as SendMessageSuccessResponse).result;
    if (
      result.kind === "message" &&
      result.parts.length > 0 &&
      result.parts[0].kind === "text"
    ) {
      reply = result.parts[0].text;
    } else {
      await deleteAttachments(attachments);
      return NextResponse.json(
        { error: "Coach returned an unexpected payload" },
        { status: 502 }
      );
    }
  } catch (err) {
    await deleteAttachments(attachments);
    const message =
      err instanceof Error ? err.message : "Couldn't reach the coaching agent";
    return NextResponse.json(
      {
        error: `${message} — is the Python agent running? Start it with \`python -m agents.coaching.agent\`.`,
      },
      { status: 503 }
    );
  }

  // Agent responded; wipe the file copies from disk and return the reply.
  // Supabase persistence is the agent's job (save_coaching_session tool).
  await deleteAttachments(attachments);

  if (!reply.trim()) {
    return NextResponse.json(
      { error: "Coach returned an empty response" },
      { status: 502 }
    );
  }

  // Persist the turn (user message + model reply) to chat_messages.
  // The latest user message is the LAST entry in the messages array;
  // earlier entries are just history we forwarded to the agent for context.
  const latestUser = [...messages].reverse().find((m) => m.role === "user");
  await persistChatTurn({
    uploader,
    sessionId,
    sessionTitle,
    userContent: latestUser?.content ?? "",
    modelContent: reply,
    attachments,
  });

  return NextResponse.json({ role: "model", content: reply });
}
