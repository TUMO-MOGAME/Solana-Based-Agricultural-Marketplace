// Browser-side voice helper. Points an <audio> element directly at the
// /api/tts GET endpoint, which lets the browser progressively buffer
// the MP3 stream — playback starts within ~1-2 seconds even though the
// full body keeps streaming for 8+ seconds (ElevenLabs streams at
// roughly 1× audio playback speed).
//
// Earlier we used POST + res.blob(), which forced us to wait for the
// full stream before starting playback. That made the button look
// frozen for ~10 seconds on the first tap. Browser-native progressive
// download is the right tool here, and as a bonus the browser HTTP
// cache (we set max-age=86400 on the response) handles repeats for us.

export type VoiceLang = "en" | "zu" | "xh" | "af" | "st";

export type VoiceRequest = {
  text: string;
  lang?: VoiceLang;
  voiceId?: string;
};

// If a play() attempt hasn't yielded a real "playing" event within
// this many ms, we treat it as a hung stream and reject. Without this
// the button can spin indefinitely if the browser is unhappy with the
// stream (e.g. waiting forever for a Range it can't get).
const PLAY_START_TIMEOUT_MS = 12_000;

// Print every audio lifecycle event when set. Flip to true to debug
// silent playback failures (e.g. tab muted, output device routing,
// codec issues). Off by default to keep the console quiet.
const DEBUG = false;

function buildSrc(req: VoiceRequest): string {
  const sp = new URLSearchParams();
  sp.set("text", req.text);
  if (req.lang) sp.set("lang", req.lang);
  if (req.voiceId) sp.set("voice", req.voiceId);
  return `/api/tts?${sp.toString()}`;
}

function describeMediaError(err: MediaError | null): string {
  if (!err) return "no error detail";
  const codes: Record<number, string> = {
    1: "playback aborted",
    2: "network error while loading",
    3: "decode error — codec or corrupt audio",
    4: "src not supported by this browser",
  };
  const label = codes[err.code] ?? `code ${err.code}`;
  return err.message ? `${label} (${err.message})` : label;
}

function readyStateLabel(s: number): string {
  switch (s) {
    case 0: return "HAVE_NOTHING";
    case 1: return "HAVE_METADATA";
    case 2: return "HAVE_CURRENT_DATA";
    case 3: return "HAVE_FUTURE_DATA";
    case 4: return "HAVE_ENOUGH_DATA";
    default: return `unknown(${s})`;
  }
}

function attachDiagnostics(audio: HTMLAudioElement, signal: AbortSignal) {
  if (!DEBUG) return;
  const events = [
    "loadstart",
    "loadedmetadata",
    "loadeddata",
    "canplay",
    "canplaythrough",
    "playing",
    "pause",
    "waiting",
    "stalled",
    "suspend",
    "abort",
    "ended",
    "error",
  ];
  for (const ev of events) {
    audio.addEventListener(
      ev,
      () => {
        // Use console.log (not .debug) so it shows up at default
        // browser-devtools verbosity.
        // eslint-disable-next-line no-console
        console.log(
          `[voice] ${ev}`,
          {
            readyState: readyStateLabel(audio.readyState),
            networkState: audio.networkState,
            currentTime: audio.currentTime,
            duration: audio.duration,
            paused: audio.paused,
            volume: audio.volume,
            muted: audio.muted,
          },
        );
      },
      { signal },
    );
  }

  // Throttled timeupdate — proves whether playback head is actually
  // advancing. If you see currentTime ticking, audio IS playing and
  // you can't hear it for system-level reasons (tab muted, output
  // device, OS volume). If it stays at 0, the audio engine is stuck.
  let lastLogged = -1;
  audio.addEventListener(
    "timeupdate",
    () => {
      const t = audio.currentTime;
      if (t - lastLogged >= 1) {
        lastLogged = t;
        // eslint-disable-next-line no-console
        console.log(`[voice] timeupdate currentTime=${t.toFixed(2)}s`);
      }
    },
    { signal },
  );
}

let currentStop: (() => void) | null = null;

export type VoicePlayback = {
  /** Resolves when the clip finishes naturally; rejects on a real audio error. */
  done: Promise<void>;
  stop: () => void;
};

export async function speak(req: VoiceRequest): Promise<VoicePlayback> {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log("[voice] speak() called", {
      chars: req.text.length,
      lang: req.lang ?? "en",
      voiceId: req.voiceId ?? "(default)",
    });
  }

  // Stop any in-flight playback first. We do NOT clear `audio.src` on
  // the previous element — setting src to "" fires its own error event
  // in some browsers, which would race with our new playback.
  currentStop?.();
  currentStop = null;

  const audio = new Audio();
  const abort = new AbortController();
  attachDiagnostics(audio, abort.signal);

  // Attach end + error listeners BEFORE setting src, so we don't miss
  // a synchronous error during initial load. AbortSignal lets stop()
  // detach both listeners atomically.
  const done = new Promise<void>((resolve, reject) => {
    audio.addEventListener("ended", () => resolve(), {
      once: true,
      signal: abort.signal,
    });
    audio.addEventListener(
      "error",
      () => {
        reject(
          new Error(`Audio playback failed: ${describeMediaError(audio.error)}`),
        );
      },
      { once: true, signal: abort.signal },
    );
  });

  // Defensive defaults — make sure we're not handing the user a muted
  // or zero-volume element if some default has drifted.
  audio.volume = 1.0;
  audio.muted = false;
  audio.preload = "auto";
  audio.src = buildSrc(req);

  let stopped = false;
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log("[voice] cleanup() called", {
        currentTime: audio.currentTime,
        paused: audio.paused,
        stack: new Error().stack?.split("\n").slice(1, 4).join(" | "),
      });
    }
    abort.abort();
    audio.pause();
    if (currentStop === cleanup) currentStop = null;
  };

  // Run cleanup whichever way `done` settles. Two handlers (one per
  // settlement path) prevent unhandled rejection in dev tools.
  done.then(cleanup, cleanup);

  currentStop = cleanup;

  // Race the play() Promise against a hard timeout. play() resolves
  // when playback has actually started; if it never does, we want to
  // surface a clear error rather than spinning forever.
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Audio didn't start within ${PLAY_START_TIMEOUT_MS}ms (readyState=${readyStateLabel(audio.readyState)}, networkState=${audio.networkState}). Check the browser console for [voice] events.`,
        ),
      );
    }, PLAY_START_TIMEOUT_MS);
  });

  try {
    await Promise.race([audio.play(), timeout]);
  } catch (e) {
    cleanup();
    if (e instanceof Error && e.name === "NotAllowedError") {
      throw new Error(
        "Browser blocked autoplay — tap the listen button again.",
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not start playback: ${msg}`);
  } finally {
    if (timer) clearTimeout(timer);
  }

  return { done, stop: cleanup };
}

export function stopSpeaking() {
  currentStop?.();
  currentStop = null;
}
