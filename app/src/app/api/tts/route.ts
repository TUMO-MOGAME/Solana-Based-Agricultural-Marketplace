// /api/tts — server-side ElevenLabs proxy.
//
// Why a proxy: the ElevenLabs API key MUST stay on the server. Calling
// the SDK from the browser would leak it. This route accepts plain text
// from the dashboard and streams MP3 audio back.
//
// Two shapes:
//   GET  /api/tts?text=...&lang=en&voice=ID  — used by <audio src="…">,
//      which gives us free progressive buffering and the browser HTTP
//      cache. This is the preferred path.
//   POST /api/tts  { text, voiceId?, languageCode? } — kept for callers
//      that want to prefetch into a Blob (e.g. fully offline-cache).
//
// Both paths return audio/mpeg.
//
// Hide-the-chain rule still applies — never put farmer PII in the text.

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Same input → same audio. Browsers and CDNs can cache aggressively.
const CACHE_HEADER = "public, max-age=86400, immutable";

// "Sarah" — premade voice in the current ElevenLabs catalogue, tagged
// "Mature, Reassuring, Confident". Premade voices ship with every plan
// (including free) so this works without a subscription. The library
// voice from the SDK example (NOpBlnGInO9m6vDvFkFC) requires a paid
// plan and 402s on free.
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
// Flash v2.5 = lowest-latency multilingual model on the free tier. We
// were on `eleven_multilingual_v2` previously (~20s for a paragraph),
// which was making the button look frozen. Flash trades a bit of voice
// quality for ~75ms-class latency. Quality is still well above good
// enough for a farmer status read-out. eleven_v3 would be even better
// but requires a paid plan.
const DEFAULT_MODEL = "eleven_flash_v2_5";
const MAX_TEXT_LEN = 1500;

type Params = { text: string; voiceId: string; languageCode: string };

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function validate(
  raw: { text?: string | null; voiceId?: string | null; languageCode?: string | null },
): { ok: true; params: Params } | { ok: false; res: Response } {
  const text = raw.text?.trim();
  if (!text) return { ok: false, res: jsonError("Missing 'text'.", 400) };
  if (text.length > MAX_TEXT_LEN) {
    return {
      ok: false,
      res: jsonError(`Text too long (max ${MAX_TEXT_LEN} chars).`, 413),
    };
  }
  const voiceId =
    raw.voiceId?.trim() ||
    process.env.ELEVENLABS_VOICE_ID ||
    DEFAULT_VOICE_ID;
  const languageCode = raw.languageCode?.trim() || "en";
  return { ok: true, params: { text, voiceId, languageCode } };
}

async function synthesize(
  apiKey: string,
  { text, voiceId, languageCode }: Params,
): Promise<Response> {
  const startedAt = Date.now();
  try {
    const client = new ElevenLabsClient({ apiKey });
    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      modelId: DEFAULT_MODEL,
      languageCode,
    });
    const generationMs = Date.now() - startedAt;
    // Visible in the Next dev terminal — invaluable when a slow model
    // makes the button look frozen. Flash should be < 2s for a paragraph.
    console.info(
      `[/api/tts] model=${DEFAULT_MODEL} voice=${voiceId} chars=${text.length} elapsed=${generationMs}ms`,
    );

    // The SDK returns a ReadableStream<Uint8Array>. Pipe it straight back
    // so the browser starts playing as bytes arrive.
    return new Response(audio as ReadableStream<Uint8Array>, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": CACHE_HEADER,
        // Lets the <audio> element seek/scrub if it wants to. Browsers
        // also use this header to know they can stream-buffer rather
        // than wait for end-of-stream.
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[/api/tts] failed after ${elapsed}ms — ${msg}`);
    return jsonError(`ElevenLabs request failed: ${msg}`, 502);
  }
}

function getApiKeyOrError(): { ok: true; key: string } | { ok: false; res: Response } {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return {
      ok: false,
      res: jsonError(
        "TTS not configured. Set ELEVENLABS_API_KEY in .env.local.",
        503,
      ),
    };
  }
  return { ok: true, key };
}

export async function GET(req: NextRequest) {
  const auth = getApiKeyOrError();
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const v = validate({
    text: sp.get("text"),
    voiceId: sp.get("voice"),
    languageCode: sp.get("lang"),
  });
  if (!v.ok) return v.res;
  return synthesize(auth.key, v.params);
}

export async function POST(req: NextRequest) {
  const auth = getApiKeyOrError();
  if (!auth.ok) return auth.res;

  let body: { text?: string; voiceId?: string; languageCode?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const v = validate(body);
  if (!v.ok) return v.res;
  return synthesize(auth.key, v.params);
}
