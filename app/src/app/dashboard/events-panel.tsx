"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Sparkles,
  Globe,
  Clock,
  AlertTriangle,
  X,
} from "lucide-react";
import styles from "./dashboard.module.css";
import {
  buildEventCoachPrompt,
  CreatorEvent,
  EventsPayload,
  FALLBACK_EVENTS,
} from "./events-data";
import { Session, useSessions } from "./sessions-context";
import { useJourney } from "./journey-context";

/* Events tab — calendar-first view of upcoming South African events.

   Layout:
     • Calendar (month grid with event dots) on the left.
     • Event list on the right, filtered by the selected day OR showing
       the whole month when no day is selected.
     • Clicking an event opens a centred detail modal with a "Talk to
       coach" CTA that seeds a fresh coaching session — same handoff
       pattern the notifications panel uses.

   Aligned events (aligned === true) render with the accent gradient on
   their title, dot, and card border. Non-aligned events render neutral
   and the coach prompt shifts to a "should I engage?" framing so the
   agent actively warns when something doesn't fit. */

type FetchState =
  | { status: "loading" }
  | { status: "ready"; payload: EventsPayload }
  | { status: "error"; message: string };

async function fetchEvents(): Promise<EventsPayload> {
  const res = await fetch("/api/events", { cache: "no-store" });
  if (!res.ok) throw new Error(`Events feed responded with ${res.status}`);
  return (await res.json()) as EventsPayload;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Build an ISO date-only key (YYYY-MM-DD) in local time — avoids the
// timezone-shift surprise you get from toISOString() on a Date whose
// local-time and UTC date differ.
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function prettyDate(key: string): string {
  return parseDateKey(key).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function daysUntil(key: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseDateKey(key);
  const diff = d.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function countdownLabel(key: string): string {
  const n = daysUntil(key);
  if (n < 0) return `${Math.abs(n)}d ago`;
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 7) return `In ${n}d`;
  if (n < 30) return `In ${Math.round(n / 7)}w`;
  return `In ${Math.round(n / 30)}mo`;
}

export default function EventsPanel({
  onBeforeChat,
}: {
  /** Fired right before a chat / journey starts — lets the dashboard
      close mobile drawers so the chat surface is visible. */
  onBeforeChat?: () => void;
}) {
  const {
    sessions,
    startEventJourney,
    startSessionFromNotification,
    loadSession,
    openChat,
  } = useSessions();
  const { openJourney } = useJourney();

  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [detail, setDetail] = useState<CreatorEvent | null>(null);

  // Active journey sessions — derived from the session list by filtering
  // for `eventTicket`. The stage banner + "resume journey" buttons read
  // from this. A ticket session is still a regular session too, so it
  // also shows up in the right-rail sessions list with a small badge.
  const journeys = useMemo(
    () =>
      sessions.filter(
        (s): s is Session & { eventTicket: NonNullable<Session["eventTicket"]> } =>
          Boolean(s.eventTicket),
      ),
    [sessions],
  );

  const journeyByEventId = useMemo(() => {
    const m = new Map<string, (typeof journeys)[number]>();
    // Most-recent session wins if there are multiple journeys per event.
    for (const j of journeys) m.set(j.eventTicket.eventId, j);
    return m;
  }, [journeys]);

  const handleCTA = useCallback(
    async (event: CreatorEvent) => {
      setDetail(null);
      onBeforeChat?.();
      // Joined event: open the journey progress panel in the right rail
      // instead of dropping straight into the chat. The panel has its own
      // "Continue coaching" button for users who want to jump to chat.
      const existing = journeyByEventId.get(event.id);
      if (existing) {
        openJourney(existing.id);
        return;
      }
      if (event.aligned) {
        await startEventJourney(event);
      } else {
        await startSessionFromNotification(buildEventCoachPrompt(event));
      }
    },
    [
      journeyByEventId,
      onBeforeChat,
      openJourney,
      startEventJourney,
      startSessionFromNotification,
    ],
  );

  const handleContinueCoaching = useCallback(
    (sessionId: string) => {
      setDetail(null);
      onBeforeChat?.();
      loadSession(sessionId);
      openChat();
    },
    [loadSession, onBeforeChat, openChat],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchEvents();
        if (!cancelled) setState({ status: "ready", payload });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "ready",
            payload: {
              source: "sample",
              generatedAt: new Date().toISOString(),
              events: FALLBACK_EVENTS,
              reason:
                err instanceof Error
                  ? err.message
                  : "Couldn't reach the events feed",
            },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape closes the detail modal first, then the day filter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detail) setDetail(null);
      else if (selectedDay) setSelectedDay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, selectedDay]);

  const events = state.status === "ready" ? state.payload.events : [];

  // Events the user sees in the right-side list — filtered by selected
  // day when one is picked, otherwise the whole visible month.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CreatorEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const visibleEvents = useMemo(() => {
    if (selectedDay) return eventsByDay.get(selectedDay) ?? [];
    return events
      .filter((e) => {
        const d = parseDateKey(e.date);
        return sameMonth(d, cursor);
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, eventsByDay, selectedDay, cursor]);

  // Grid cells for the month view. Always 42 cells (6 weeks) so the grid
  // doesn't jump heights between 28/29/30/31-day months.
  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = first.getDay(); // Sun = 0
    const start = new Date(first);
    start.setDate(start.getDate() - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [cursor]);

  const goToday = useCallback(() => {
    const today = new Date();
    setCursor(today);
    setSelectedDay(toDateKey(today));
  }, []);

  const prevMonth = useCallback(() => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
    setSelectedDay(null);
  }, []);

  const nextMonth = useCallback(() => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
    setSelectedDay(null);
  }, []);

  return (
    <div className={styles.eventsRoot}>
      <header className={styles.eventsHeader}>
        <div>
          <h1 className={styles.eventsTitle}>Events in South Africa</h1>
          <p className={styles.eventsSub}>
            Pick an event to plan content with your coach — aligned events are
            highlighted.
          </p>
        </div>
        <button type="button" className={styles.eventsTodayBtn} onClick={goToday}>
          Today
        </button>
      </header>

      <div className={styles.eventsBody}>
        {/* ─── Calendar ─── */}
        <aside className={styles.eventsCalendar} aria-label="Month calendar">
          <div className={styles.eventsCalendarNav}>
            <button
              type="button"
              className={styles.eventsCalNavBtn}
              onClick={prevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft />
            </button>
            <div className={styles.eventsCalendarMonth}>
              {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
            </div>
            <button
              type="button"
              className={styles.eventsCalNavBtn}
              onClick={nextMonth}
              aria-label="Next month"
            >
              <ChevronRight />
            </button>
          </div>

          <div className={styles.eventsCalendarGrid}>
            {DAY_LABELS.map((d, i) => (
              <div key={i} className={styles.eventsCalendarDayLabel}>
                {d}
              </div>
            ))}
            {monthCells.map((d) => {
              const key = toDateKey(d);
              const inMonth = sameMonth(d, cursor);
              const dayEvents = eventsByDay.get(key) ?? [];
              const hasAligned = dayEvents.some((e) => e.aligned);
              const hasOther = dayEvents.some((e) => !e.aligned);
              const hasJoined = dayEvents.some((e) =>
                journeyByEventId.has(e.id),
              );
              const isToday = toDateKey(new Date()) === key;
              const isSelected = selectedDay === key;

              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    styles.eventsCalendarCell,
                    inMonth ? "" : styles.outMonth,
                    isToday ? styles.isToday : "",
                    isSelected ? styles.isSelected : "",
                    dayEvents.length ? styles.hasEvents : "",
                    hasJoined ? styles.hasJoined : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() =>
                    setSelectedDay(isSelected ? null : key)
                  }
                  aria-pressed={isSelected}
                  aria-label={`${d.toDateString()}${dayEvents.length ? ` — ${dayEvents.length} event(s)${hasJoined ? " (joined)" : ""}` : ""}`}
                >
                  <span className={styles.eventsCalendarCellNum}>
                    {d.getDate()}
                  </span>
                  {(hasAligned || hasOther || hasJoined) && (
                    <span className={styles.eventsCalendarCellDots}>
                      {hasJoined && (
                        <span
                          className={`${styles.eventsCalendarDot} ${styles.dotJoined}`}
                          aria-hidden="true"
                        />
                      )}
                      {hasAligned && !hasJoined && (
                        <span
                          className={`${styles.eventsCalendarDot} ${styles.dotAligned}`}
                          aria-hidden="true"
                        />
                      )}
                      {hasOther && (
                        <span
                          className={`${styles.eventsCalendarDot} ${styles.dotNeutral}`}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className={styles.eventsLegend}>
            <div>
              <span
                className={`${styles.eventsLegendDot} ${styles.dotJoined}`}
                aria-hidden="true"
              />
              Joined — journey in progress
            </div>
            <div>
              <span
                className={`${styles.eventsLegendDot} ${styles.dotAligned}`}
                aria-hidden="true"
              />
              Aligned with your content
            </div>
            <div>
              <span
                className={`${styles.eventsLegendDot} ${styles.dotNeutral}`}
                aria-hidden="true"
              />
              Other SA events
            </div>
          </div>
        </aside>

        {/* ─── Event list ─── */}
        <section className={styles.eventsList} aria-label="Event list">
          <div className={styles.eventsListHeader}>
            <h2 className={styles.eventsListTitle}>
              {selectedDay
                ? prettyDate(selectedDay)
                : `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`}
            </h2>
            {selectedDay && (
              <button
                type="button"
                className={styles.eventsClearFilter}
                onClick={() => setSelectedDay(null)}
              >
                Show whole month
              </button>
            )}
          </div>

          {state.status === "loading" ? (
            <div className={styles.eventsEmpty}>Loading events…</div>
          ) : visibleEvents.length === 0 ? (
            <div className={styles.eventsEmpty}>
              No events on this {selectedDay ? "day" : "month"}.
            </div>
          ) : (
            <ul className={styles.eventsItems}>
              {visibleEvents.map((e) => {
                const hasJourney = Boolean(journeyByEventId.get(e.id));
                return (
                  <li
                    key={e.id}
                    className={`${styles.eventCard} ${e.aligned ? styles.eventCardAligned : ""}`}
                  >
                    <button
                      type="button"
                      className={styles.eventCardBtn}
                      onClick={() => setDetail(e)}
                    >
                      <div className={styles.eventCardLeft}>
                        <div className={styles.eventCardDateDay}>
                          {parseDateKey(e.date).getDate()}
                        </div>
                        <div className={styles.eventCardDateMon}>
                          {MONTH_NAMES[parseDateKey(e.date).getMonth()].slice(0, 3)}
                        </div>
                        <div className={styles.eventCardCountdown}>
                          {countdownLabel(e.date)}
                        </div>
                      </div>
                      <div className={styles.eventCardRight}>
                        <div className={styles.eventCardMeta}>
                          <span className={styles.eventCardCategory}>
                            {e.aligned ? <Sparkles /> : <CalendarDays />}
                            {e.category}
                          </span>
                          {e.time && (
                            <span className={styles.eventCardTime}>
                              <Clock />
                              {e.time}
                            </span>
                          )}
                          {hasJourney && (
                            <span className={styles.eventCardJourneyPill}>
                              Journey active
                            </span>
                          )}
                        </div>
                        <h3 className={styles.eventCardTitle}>{e.title}</h3>
                        <div className={styles.eventCardWhere}>
                          <MapPin />
                          <span>
                            {e.venue} · {e.city}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ─── Detail modal ─── */}
      {detail && (
        <EventDetailModal
          event={detail}
          journeySessionId={journeyByEventId.get(detail.id)?.id}
          onClose={() => setDetail(null)}
          onTalkToCoach={() => void handleCTA(detail)}
          onContinueCoaching={
            journeyByEventId.get(detail.id)
              ? () => handleContinueCoaching(journeyByEventId.get(detail.id)!.id)
              : undefined
          }
        />
      )}
    </div>
  );
}

function EventDetailModal({
  event,
  journeySessionId,
  onClose,
  onTalkToCoach,
  onContinueCoaching,
}: {
  event: CreatorEvent;
  /** Populated when the user has already joined this event — the primary
      CTA becomes "View journey progress" instead of "Start event journey",
      and a secondary "Continue coaching" action appears. */
  journeySessionId?: string;
  onClose: () => void;
  onTalkToCoach: () => void;
  onContinueCoaching?: () => void;
}) {
  const hasJourney = Boolean(journeySessionId);
  const dateLabel = new Date(event.date).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const endLabel = event.endDate
    ? new Date(event.endDate).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <div
      className={styles.eventDetailBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={event.title}
    >
      <div
        className={`${styles.eventDetail} ${event.aligned ? styles.eventDetailAligned : ""}`}
      >
        <button
          type="button"
          className={styles.eventDetailClose}
          onClick={onClose}
          aria-label="Close"
        >
          <X />
        </button>

        <div className={styles.eventDetailEyebrow}>
          {event.aligned ? (
            <>
              <Sparkles /> Aligned with your content
            </>
          ) : (
            <>
              <AlertTriangle /> Review before engaging
            </>
          )}
        </div>

        <h2 className={styles.eventDetailTitle}>{event.title}</h2>

        <div className={styles.eventDetailMetaRow}>
          <span className={styles.eventDetailMetaItem}>
            <CalendarDays />
            {dateLabel}
            {endLabel ? ` → ${endLabel}` : ""}
          </span>
          {event.time && (
            <span className={styles.eventDetailMetaItem}>
              <Clock />
              {event.time} SAST
            </span>
          )}
          <span className={styles.eventDetailMetaItem}>
            <MapPin />
            {event.venue}, {event.city}
          </span>
          {event.website && (
            <a
              className={styles.eventDetailMetaItem}
              href={event.website}
              target="_blank"
              rel="noreferrer"
            >
              <Globe />
              Visit website
            </a>
          )}
        </div>

        <p className={styles.eventDetailDescription}>{event.description}</p>

        <div
          className={`${styles.eventDetailNote} ${event.aligned ? styles.noteAligned : styles.noteWarn}`}
        >
          <span className={styles.eventDetailNoteLabel}>
            {event.aligned ? "Why it fits your content" : "Coach's caution"}
          </span>
          <p>{event.alignmentNote}</p>
        </div>

        {event.tags.length > 0 && (
          <div className={styles.eventDetailTags}>
            {event.tags.map((t) => (
              <span key={t} className={styles.eventDetailTag}>
                #{t}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          className={styles.eventDetailCTA}
          onClick={onTalkToCoach}
        >
          {hasJourney
            ? "View journey progress"
            : event.aligned
              ? "Start event journey"
              : "Ask the coach if I should engage"}
        </button>

        {hasJourney && onContinueCoaching && (
          <button
            type="button"
            className={styles.eventDetailCTASecondary}
            onClick={onContinueCoaching}
          >
            Continue coaching in chat
          </button>
        )}
      </div>
    </div>
  );
}
