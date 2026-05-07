"use client";

import { KeyboardEvent, MouseEvent } from "react";
import { Plus, Trash2, Ticket } from "lucide-react";
import { useSessions } from "./sessions-context";
import { computeStage, stageLabel } from "./events-journey";
import styles from "./dashboard.module.css";

/*  Right-rail session list — one row per saved coaching conversation.
    Clicking a row loads that thread and flips the dashboard into chat
    mode. "New" starts a fresh thread and opens the chat too. Delete
    removes the session from localStorage (and clears the chat if it was
    the active one). */

const cx = (...parts: Array<string | false | undefined | null>) =>
  parts.filter(Boolean).join(" ");

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = (Date.now() - then) / 1000;
  if (diff < 45) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return "Yesterday";
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function SessionsList({
  userName,
  userAvatar,
}: {
  userName: string;
  userAvatar: string;
}) {
  const {
    sessions,
    activeId,
    newSession,
    loadSession,
    deleteSession,
    openChat,
  } = useSessions();

  const startNew = () => {
    newSession();
    openChat();
  };

  const openSession = (id: string) => {
    loadSession(id);
    openChat();
  };

  const handleRowKey = (id: string) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openSession(id);
    }
  };

  const handleDelete =
    (id: string) => (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (typeof window !== "undefined" && window.confirm("Delete this session?")) {
        deleteSession(id);
      }
    };

  return (
    <>
      <div className={styles.sessionsHeader}>
        <h3 className={styles.rightTitle}>Sessions</h3>
        <button
          type="button"
          className={styles.newSessionBtn}
          onClick={startNew}
        >
          <Plus />
          New
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className={styles.sessionsEmpty}>
          No sessions yet. Start a new one and your threads will show up here.
        </div>
      ) : (
        <div className={styles.sessionsList}>
          {sessions.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              className={cx(styles.sessionItem, activeId === s.id && styles.active)}
              onClick={() => openSession(s.id)}
              onKeyDown={handleRowKey(s.id)}
              aria-current={activeId === s.id ? "true" : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.sessionAvatar}
                src={userAvatar}
                alt={userName}
              />
              <div className={styles.sessionBody}>
                <div className={styles.sessionRow}>
                  <span className={styles.sessionTitle}>{s.title}</span>
                  <span className={styles.sessionTime}>
                    {relativeTime(s.updatedAt)}
                  </span>
                </div>
                {s.eventTicket ? (
                  <div
                    className={`${styles.sessionJourneyBadge} ${
                      styles[`badgeStage_${computeStage(s.eventTicket)}`] ?? ""
                    }`}
                  >
                    <Ticket />
                    <span>{stageLabel(computeStage(s.eventTicket))}</span>
                    <span className={styles.sessionJourneyEvent}>
                      {s.eventTicket.eventTitle}
                    </span>
                  </div>
                ) : s.summary ? (
                  <div className={styles.sessionSummary}>{s.summary}</div>
                ) : (
                  <div className={styles.sessionSummaryMuted}>
                    {s.messages.length > 0
                      ? "Coach is reviewing…"
                      : "Empty session"}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={styles.sessionDelete}
                onClick={handleDelete(s.id)}
                aria-label={`Delete session: ${s.title}`}
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
