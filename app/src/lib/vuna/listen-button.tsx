"use client";

// Speaker icon → tap to hear the surrounding text in the farmer's
// language. Three visible states: idle, loading, playing. Tap while
// playing → stop.
//
// Lives next to greetings, alerts, payout banners — anywhere a farmer
// might prefer to listen rather than read. Hide-the-chain rule: the
// `text` we synthesise is plain Rand-and-language, never crypto jargon.

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Loader2, AlertCircle } from "lucide-react";
import { speak, stopSpeaking, type VoiceLang, type VoicePlayback } from "./voice";

type Props = {
  text: string;
  lang?: VoiceLang;
  voiceId?: string;
  /** Auto-play once when the component mounts. Honours browser gesture rules. */
  autoPlay?: boolean;
  /** Visual size — affects the icon button only. */
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
};

type State = "idle" | "loading" | "playing" | "error";

export function ListenButton({
  text,
  lang = "en",
  voiceId,
  autoPlay = false,
  size = "md",
  className,
  ariaLabel,
}: Props) {
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const playbackRef = useRef<VoicePlayback | null>(null);

  // We deliberately do NOT call playbackRef.current?.stop() in an
  // unmount cleanup. React 19 + Next.js StrictMode mount the component
  // twice in dev (mount → cleanup → re-mount), and an unmount cleanup
  // here would silently pause the audio after only a few millisec.
  // The browser's tab/page lifecycle handles real unmount cleanup —
  // when the user navigates away, the page is torn down and audio
  // stops naturally.

  const start = async () => {
    if (state === "loading" || state === "playing") return;
    setErrorMsg(null);
    setState("loading");
    try {
      const pb = await speak({ text, lang, voiceId });
      playbackRef.current = pb;
      setState("playing");
      pb.done
        .then(() => {
          if (playbackRef.current === pb) playbackRef.current = null;
          setState("idle");
        })
        .catch((err) => {
          if (playbackRef.current === pb) playbackRef.current = null;
          // Surface the real cause so the title tooltip is useful.
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setState("error");
          console.error("[ListenButton] playback ended with error:", err);
        });
    } catch (e) {
      setState("error");
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      console.error("[ListenButton] failed to start playback:", e);
    }
  };

  const stop = () => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setState("idle");
  };

  // Auto-play on mount (only fires once). Browsers block this without a
  // prior user gesture — if play() rejects, we just stay in the idle
  // state and the user can tap to listen.
  useEffect(() => {
    if (!autoPlay) return;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  const dim = size === "sm" ? 30 : 36;
  const iconDim = size === "sm" ? 14 : 16;

  const isBusy = state === "loading" || state === "playing";
  const Icon =
    state === "loading"
      ? Loader2
      : state === "playing"
      ? VolumeX
      : state === "error"
      ? AlertCircle
      : Volume2;

  // Tap behaviour: while busy → stop, while errored → retry, otherwise → play.
  const handleClick = () => {
    if (isBusy) return stop();
    if (state === "error") {
      setState("idle");
      setErrorMsg(null);
    }
    void start();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        ariaLabel ??
        (state === "playing"
          ? "Stop voice"
          : state === "error"
          ? "Voice failed — tap to retry"
          : "Listen — read aloud")
      }
      title={
        state === "error" && errorMsg
          ? `Voice error — tap to retry. Detail: ${errorMsg}`
          : errorMsg ?? undefined
      }
      className={className}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: dim,
        height: dim,
        borderRadius: 999,
        background:
          state === "playing"
            ? "linear-gradient(135deg, #ff7b6b, #ffb86b)"
            : state === "error"
            ? "rgba(192, 57, 43, 0.18)"
            : "rgba(255, 255, 255, 0.06)",
        color:
          state === "playing"
            ? "#1a0f0c"
            : state === "error"
            ? "#ff9b8e"
            : "rgba(255, 245, 230, 0.92)",
        border:
          state === "playing"
            ? "1px solid rgba(255, 184, 107, 0.55)"
            : state === "error"
            ? "1px solid rgba(192, 57, 43, 0.55)"
            : "1px solid rgba(255, 230, 210, 0.14)",
        boxShadow:
          state === "playing"
            ? "0 8px 20px rgba(255, 123, 107, 0.35)"
            : "none",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        transition: "background 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      <Icon
        size={iconDim}
        style={
          state === "loading"
            ? { animation: "vuna-listen-spin 0.8s linear infinite" }
            : undefined
        }
      />
      <style jsx>{`
        @keyframes vuna-listen-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}

export { stopSpeaking };
