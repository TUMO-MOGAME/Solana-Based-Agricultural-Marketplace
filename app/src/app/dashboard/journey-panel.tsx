"use client";

import { useState } from "react";
import { X, Ticket, MapPin, CalendarDays, MessageSquare, Lock, Activity } from "lucide-react";
import { useJourney } from "./journey-context";
import { useSessions } from "./sessions-context";
import { usePipeline } from "./pipeline-context";
import {
  computeStage,
  stageAction,
  stageLabel,
  JourneyStage,
  JOURNEY_CLOSE_DAYS,
} from "./events-journey";
import styles from "./dashboard.module.css";

/**
 * Right-rail panel — swaps in for SessionsList when the user opens a joined
 * event's progress view. Renders the stage progression, the current action
 * hint, and two actions: continue coaching (jumps into the chat) or close
 * the journey (freezes it read-only).
 */

const STAGE_ORDER: JourneyStage[] = [
  "planning",
  "imminent",
  "during",
  "after",
  "closed",
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function nextStageFor(stage: JourneyStage): JourneyStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export default function JourneyPanel() {
  const { journeySessionId, closeJourney } = useJourney();
  const { sessions, loadSession, openChat, closeEventJourney } = useSessions();
  const { openRun: openPipelineRun } = usePipeline();
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  if (!journeySessionId) return null;

  const session = sessions.find((s) => s.id === journeySessionId);
  const ticket = session?.eventTicket;

  if (!session || !ticket) {
    // Session disappeared (deleted / storage cleared) — render an empty
    // state so the user can dismiss the panel without the app crashing.
    return (
      <div className={styles.journeyPanel}>
        <header className={styles.journeyPanelHeader}>
          <div className={styles.journeyPanelHeaderLeft}>
            <div className={styles.journeyPanelIcon}>
              <Ticket />
            </div>
            <div className={styles.journeyPanelTitleWrap}>
              <span className={styles.journeyPanelEyebrow}>Event journey</span>
              <h3 className={styles.journeyPanelTitle}>Journey not found</h3>
            </div>
          </div>
          <button
            type="button"
            className={styles.journeyPanelClose}
            onClick={closeJourney}
            aria-label="Close panel"
          >
            <X />
          </button>
        </header>
        <p className={styles.journeyPanelEmpty}>
          This journey is no longer available. It may have been deleted.
        </p>
      </div>
    );
  }

  const stage = computeStage(ticket);
  const action = stageAction(ticket);
  const next = nextStageFor(stage);
  const daysToStart = daysUntil(ticket.eventDate);
  const daysToEnd = daysUntil(ticket.eventEndDate ?? ticket.eventDate);
  const isClosed = stage === "closed";

  // Summarise when the next stage begins — keeps the user oriented about
  // how much runway they have before the journey flips states.
  let nextHint = "";
  if (next === "imminent") nextHint = `In ${Math.max(0, daysToStart - 2)} day(s)`;
  else if (next === "during") nextHint = daysToStart > 0 ? `In ${daysToStart} day(s)` : "Today";
  else if (next === "after") nextHint = daysToEnd > 0 ? `In ${daysToEnd} day(s)` : "Tomorrow";
  else if (next === "closed") nextHint = `Auto-closes ${JOURNEY_CLOSE_DAYS} days after the event`;

  return (
    <div className={styles.journeyPanel}>
      <header className={styles.journeyPanelHeader}>
        <div className={styles.journeyPanelHeaderLeft}>
          <div className={styles.journeyPanelIcon}>
            <Ticket />
          </div>
          <div className={styles.journeyPanelTitleWrap}>
            <span className={styles.journeyPanelEyebrow}>Event journey</span>
            <h3 className={styles.journeyPanelTitle} title={ticket.eventTitle}>
              {ticket.eventTitle}
            </h3>
          </div>
        </div>
        <button
          type="button"
          className={styles.journeyPanelClose}
          onClick={closeJourney}
          aria-label="Close panel"
          title="Close panel"
        >
          <X />
        </button>
      </header>

      {/* Event meta */}
      <div className={styles.journeyPanelMeta}>
        <div className={styles.journeyPanelMetaRow}>
          <CalendarDays />
          <span>{formatDate(ticket.eventDate)}</span>
        </div>
        <div className={styles.journeyPanelMetaRow}>
          <MapPin />
          <span>{ticket.eventVenue}, {ticket.eventCity}</span>
        </div>
      </div>

      {/* Stage progression */}
      <div className={styles.journeyPanelProgress} aria-label="Journey stages">
        {STAGE_ORDER.map((s, i) => {
          const currentIdx = STAGE_ORDER.indexOf(stage);
          const state =
            i < currentIdx ? "past" : i === currentIdx ? "current" : "future";
          return (
            <div
              key={s}
              className={`${styles.journeyStep} ${styles[`journeyStep_${state}`]}`}
            >
              <div className={styles.journeyStepDot}>{i + 1}</div>
              <span className={styles.journeyStepLabel}>{stageLabel(s)}</span>
            </div>
          );
        })}
      </div>

      {/* Current stage */}
      <div className={`${styles.journeyPanelCurrent} ${styles[`currentStage_${stage}`] ?? ""}`}>
        <span className={styles.journeyPanelCurrentLabel}>
          Current stage · {stageLabel(stage)}
        </span>
        <h4 className={styles.journeyPanelCurrentHeading}>{action.heading}</h4>
        <p className={styles.journeyPanelCurrentBody}>{action.body}</p>
      </div>

      {/* Next stage */}
      {next && !isClosed && (
        <div className={styles.journeyPanelNext}>
          <span className={styles.journeyPanelNextLabel}>Next stage</span>
          <div className={styles.journeyPanelNextRow}>
            <strong>{stageLabel(next)}</strong>
            <span>{nextHint}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className={styles.journeyPanelActions}>
        <button
          type="button"
          className={styles.journeyPanelPrimary}
          onClick={() => {
            loadSession(session.id);
            openChat();
            closeJourney();
          }}
          disabled={isClosed}
        >
          <MessageSquare />
          <span>{isClosed ? "Thread is read-only" : "Continue coaching"}</span>
        </button>

        {/* Heavy action: kick off the orchestrator pipeline scoped to
            this event. Replaces the JourneyPanel with the live pipeline
            view. ~5–15 min, ~5 daily slots. */}
        {!isClosed && (
          <button
            type="button"
            className={styles.journeyPanelSecondary}
            disabled={pipelineBusy}
            onClick={async () => {
              setPipelineError(null);
              setPipelineBusy(true);
              const briefDate = formatDate(ticket.eventDate);
              const promptInput =
                `Plan content for the event "${ticket.eventTitle}" ` +
                `(${ticket.eventCategory}) at ${ticket.eventVenue}, ` +
                `${ticket.eventCity} on ${briefDate}. ` +
                `Current stage: ${stage}. Produce pre-event teasers, an ` +
                `event-day shoot list, and a post-event recap plan. ` +
                `Optimise for short-form vertical video.`;
              try {
                const res = await fetch("/api/orchestrate", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    intent: "event_journey",
                    input: promptInput,
                    seed: {
                      event_id:    ticket.eventId,
                      event_title: ticket.eventTitle,
                      event_date:  ticket.eventDate,
                      event_city:  ticket.eventCity,
                      event_venue: ticket.eventVenue,
                      category:    ticket.eventCategory,
                      stage,
                      session_id:  session.id,
                    },
                  }),
                });
                const json = (await res.json()) as { run_id?: string; error?: string };
                if (!res.ok || !json.run_id) {
                  throw new Error(json.error ?? `${res.status}`);
                }
                openPipelineRun(json.run_id);
                closeJourney();
              } catch (e) {
                setPipelineError(e instanceof Error ? e.message : String(e));
              } finally {
                setPipelineBusy(false);
              }
            }}
          >
            <Activity />
            <span>{pipelineBusy ? "Starting…" : "Generate full plan"}</span>
          </button>
        )}

        {pipelineError ? (
          <div className={styles.journeyPanelPipelineError}>
            {pipelineError.includes("cooldown")
              ? "Pipeline cooldown — try again in a few minutes."
              : pipelineError.includes("daily cap")
                ? "Daily pipeline cap reached."
                : pipelineError}
          </div>
        ) : null}

        {!isClosed && (
          <button
            type="button"
            className={styles.journeyPanelSecondary}
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                window.confirm(
                  "Close this event journey? The thread becomes read-only.",
                )
              ) {
                closeEventJourney(session.id);
              }
            }}
          >
            <Lock />
            <span>Close journey</span>
          </button>
        )}
      </div>
    </div>
  );
}
