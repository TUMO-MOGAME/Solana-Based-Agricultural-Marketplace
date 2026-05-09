"use client";

// Guided voice tour for the dashboard.
//
// Plays a short narration that walks a brand-new farmer through what each
// part of the dashboard does. As each step speaks, the dashboard tab (or
// the highlighted sidebar item, in the wallet step) changes so the user
// sees what's being described.
//
// Design rules carried over from CLAUDE.md:
//   - Hide the chain. Never say "blockchain", "Solana", "USDC", "stablecoin".
//     "Wallet" is OK because it's already on screen as a label.
//   - Currency is Rand. The narration mentions Rand explicitly.
//   - Mobile-first. Steps are short — ~10–15s each, ~80s total.
//   - Dynamic. Uses the user's firstName, the current wallet state, and the
//     active-pack copy so the tour reflects what the farmer is actually
//     looking at, not a generic script.

import { useCallback, useRef, useState } from "react";
import { Compass, Square } from "lucide-react";
import { speak, warmupTts, type VoicePlayback } from "./voice";

export type TourTabId =
  | "active"
  | "apply"
  | "insurance"
  | "history"
  | "about"
  | "marketplace";

export type TourContext = {
  firstName: string;
  walletShort: string | null;
  activePack: {
    crop: string;
    region: string;
  };
};

type Step = {
  id: string;
  label: string;
  tab: TourTabId;
  highlightWallet?: boolean;
  text: (ctx: TourContext) => string;
};

const TOUR_STEPS: Step[] = [
  {
    id: "welcome",
    label: "Welcome",
    tab: "active",
    text: (c) =>
      `Hi ${c.firstName}. This is Mazra'at albaan — your farm in your phone. Let me show you around in about a minute.`,
  },
  {
    id: "home",
    label: "Home",
    tab: "active",
    text: (c) =>
      `This is your home. Your ${c.activePack.crop.toLowerCase()} crop in ${c.activePack.region}, the weather for the week, and your repayment date — everything for this season at one glance.`,
  },
  {
    id: "apply",
    label: "Apply for a Grow Pack",
    tab: "apply",
    text: () =>
      `When you need seeds, fertilizer, and drought cover, you tap Apply. You pay nothing upfront. The cost is taken only after your harvest is sold.`,
  },
  {
    id: "insurance",
    label: "Drought protection",
    tab: "insurance",
    text: () =>
      `This is your drought protection. If rainfall in your area drops too low for too long, money is sent to you automatically. No claim form. No waiting.`,
  },
  {
    id: "wallet",
    label: "Your wallet",
    tab: "active",
    highlightWallet: true,
    text: (c) =>
      c.walletShort
        ? `Your wallet is set up. Drought payouts and harvest sales land here on their own — no extra steps for you.`
        : `This is your wallet button. You set it up once. After that, drought payouts and harvest sales come to you with no extra steps. You will never see any technical words — only Rand.`,
  },
  {
    id: "marketplace",
    label: "Marketplace",
    tab: "marketplace",
    text: () =>
      `When your harvest is ready, you list it here. Buyers pay you direct, in Rand — no middlemen taking forty percent of what you grew.`,
  },
  {
    id: "close",
    label: "All set",
    tab: "active",
    text: (c) =>
      `That's the whole tour, ${c.firstName}. Every amount you see is in Rand. We handle the rest behind the scenes. Now you can start.`,
  },
];

export type TourState = {
  running: boolean;
  stepIdx: number;
  totalSteps: number;
  currentLabel: string | null;
};

type TourCallbacks = {
  onNavigateToTab: (tab: TourTabId) => void;
  onHighlightWallet: (highlight: boolean) => void;
};

export type DashboardTourHook = TourState & {
  start: () => Promise<void>;
  stop: () => void;
};

export function useDashboardTour(
  ctx: TourContext,
  callbacks: TourCallbacks,
): DashboardTourHook {
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  // Mirror props into refs so the long-running async start() loop always
  // reads the latest values without forcing the loop to be re-created on
  // every render. Without this, every parent re-render (e.g. the wallet
  // step toggling its highlight) would reset useCallback identity.
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const cancelRef = useRef(false);
  const pbRef = useRef<VoicePlayback | null>(null);
  const runningRef = useRef(false);

  const stop = useCallback(() => {
    cancelRef.current = true;
    runningRef.current = false;
    pbRef.current?.stop();
    pbRef.current = null;
    cbRef.current.onHighlightWallet(false);
    setRunning(false);
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelRef.current = false;
    setRunning(true);
    setStepIdx(0);

    // Compile the /api/tts route up-front. In Next.js dev, the first hit
    // can take 10–16s while the route compiles, which would blow past the
    // <audio> play-start timeout in voice.ts and silently kill step 1.
    // Warmup short-circuits without calling ElevenLabs, so we pay only the
    // compile cost — once — before any real audio is requested.
    await warmupTts();
    if (cancelRef.current) {
      runningRef.current = false;
      setRunning(false);
      return;
    }

    for (let i = 0; i < TOUR_STEPS.length; i++) {
      if (cancelRef.current) break;
      const step = TOUR_STEPS[i];
      setStepIdx(i);

      cbRef.current.onNavigateToTab(step.tab);
      cbRef.current.onHighlightWallet(!!step.highlightWallet);

      // Let React render the new tab + highlight before voice starts so
      // the visual change lines up with what the user hears.
      await sleep(450);
      if (cancelRef.current) break;

      try {
        const pb = await speak({
          text: step.text(ctxRef.current),
          lang: "en",
        });
        pbRef.current = pb;
        await pb.done;
      } catch (err) {
        // One bad step shouldn't kill the whole tour — log and move on.
        // Common cause: TTS not configured (503 from /api/tts).
        console.warn("[tour] step skipped:", err);
      }
      pbRef.current = null;

      if (cancelRef.current) break;
      await sleep(350);
    }

    cbRef.current.onHighlightWallet(false);
    runningRef.current = false;
    setRunning(false);
  }, []);

  return {
    running,
    stepIdx,
    totalSteps: TOUR_STEPS.length,
    currentLabel: running ? TOUR_STEPS[stepIdx]?.label ?? null : null,
    start,
    stop,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Sidebar trigger ─────────────────────────────────────────────────

type TriggerProps = {
  tour: DashboardTourHook;
  className?: string;
  metaClassName?: string;
};

export function TourMenuItem({ tour, className, metaClassName }: TriggerProps) {
  const handle = () => {
    if (tour.running) tour.stop();
    else void tour.start();
  };
  return (
    <button
      type="button"
      onClick={handle}
      className={className}
      aria-label={tour.running ? "Stop guided tour" : "Start guided tour"}
      title={
        tour.running
          ? "Stop the tour"
          : "Take a 1-minute guided tour, voiced"
      }
    >
      <Compass />
      <span>{tour.running ? "Stop tour" : "Take a tour"}</span>
      <span
        className={metaClassName}
        style={
          tour.running
            ? {
                background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                color: "#1a0f0c",
                borderColor: "rgba(255, 184, 107, 0.55)",
              }
            : undefined
        }
      >
        {tour.running ? `${tour.stepIdx + 1}/${tour.totalSteps}` : "voice"}
      </span>
    </button>
  );
}

// ─── Floating overlay shown while the tour runs ──────────────────────

export function TourOverlay({ tour }: { tour: DashboardTourHook }) {
  if (!tour.running) return null;
  const pct = Math.round(((tour.stepIdx + 1) / tour.totalSteps) * 100);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 80,
        background: "rgba(22, 11, 8, 0.92)",
        border: "1px solid rgba(255, 184, 107, 0.45)",
        boxShadow: "0 18px 38px rgba(255, 123, 107, 0.30)",
        borderRadius: 14,
        padding: "12px 14px",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        maxWidth: 320,
        color: "rgba(255, 245, 230, 0.92)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
          color: "#1a0f0c",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          boxShadow: "0 8px 18px rgba(255, 123, 107, 0.35)",
        }}
      >
        <Compass size={16} />
      </div>
      <div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(255, 230, 210, 0.55)",
          }}
        >
          Tour · step {tour.stepIdx + 1} of {tour.totalSteps}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "rgba(255, 245, 230, 0.95)",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {tour.currentLabel}
        </div>
        <div
          aria-hidden="true"
          style={{
            marginTop: 8,
            height: 3,
            borderRadius: 999,
            background: "rgba(255, 230, 210, 0.10)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={tour.stop}
        aria-label="Stop tour"
        title="Stop tour"
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          border: "1px solid rgba(255, 230, 210, 0.18)",
          background: "rgba(255, 255, 255, 0.06)",
          color: "rgba(255, 245, 230, 0.92)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <Square size={12} />
      </button>
    </div>
  );
}
