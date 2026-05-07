import type { CreatorEvent } from "./events-data";

/*  Event-journey system — Phase 2 of the Events feature.

    A "journey" is a persistent coaching session tied to a specific
    event. Architecturally it is still a regular Session (see
    sessions-context.tsx) with an optional `eventTicket` field. The
    journey's *stage* is NEVER stored — we always derive it from the
    event date + current clock, so the banner stays correct across days
    without any scheduler or sync.

    Stages
      planning  — > 2 days before event
      imminent  — 0-2 days before event (pre-event teaser window)
      during    — event day(s) (handles multi-day via eventEndDate)
      after     — 1-7 days post-event (recap window)
      closed    — > 7 days post-event OR manually closed by user

    A ticket session becomes read-only once stage === "closed". The
    coach also receives a machine-readable journey hint (see
    buildJourneyHint) on every turn so it always knows the current
    stage and doesn't have to infer it from message history. */

export type JourneyStage =
  | "planning"
  | "imminent"
  | "during"
  | "after"
  | "closed";

export interface EventTicket {
  eventId: string;
  eventTitle: string;
  eventDate: string; // ISO date-only, e.g. "2026-04-25"
  eventEndDate?: string;
  eventCity: string;
  eventVenue: string;
  eventCategory: string;
  /** Timestamp set when the user manually closes the journey. Absent
      until closed; once present, stage is always "closed". */
  closedAt?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days after event end before we auto-lock the journey. */
export const JOURNEY_CLOSE_DAYS = 7;

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function computeStage(
  ticket: EventTicket,
  now: Date = new Date(),
): JourneyStage {
  if (ticket.closedAt) return "closed";
  const today = startOfDay(now);
  const start = startOfDay(parseDateKey(ticket.eventDate));
  const end = startOfDay(parseDateKey(ticket.eventEndDate ?? ticket.eventDate));
  const daysToStart = Math.round((start.getTime() - today.getTime()) / DAY_MS);
  const daysFromEnd = Math.round((today.getTime() - end.getTime()) / DAY_MS);

  if (daysFromEnd > JOURNEY_CLOSE_DAYS) return "closed";
  if (today >= start && today <= end) return "during";
  if (daysFromEnd > 0) return "after";
  if (daysToStart <= 2) return "imminent";
  return "planning";
}

/** User-facing short label for the stage badge. */
export function stageLabel(stage: JourneyStage): string {
  switch (stage) {
    case "planning":
      return "Planning";
    case "imminent":
      return "Imminent";
    case "during":
      return "Event day";
    case "after":
      return "Post-event";
    case "closed":
      return "Closed";
  }
}

/** Short actionable hint shown in the journey banner above the chat. */
export function stageAction(
  ticket: EventTicket,
  now: Date = new Date(),
): { heading: string; body: string } {
  const stage = computeStage(ticket, now);
  const daysTo = daysUntil(ticket.eventDate, now);
  const daysFrom = daysPast(ticket.eventEndDate ?? ticket.eventDate, now);
  const daysLeft = JOURNEY_CLOSE_DAYS - daysFrom;

  switch (stage) {
    case "planning":
      return {
        heading: `${daysTo} days until ${ticket.eventTitle}`,
        body: "Sketch 2–3 pre-event hooks with your coach this week. First teaser post should land 5–7 days out.",
      };
    case "imminent":
      return {
        heading:
          daysTo === 0
            ? "Event starts today"
            : `${daysTo} day${daysTo === 1 ? "" : "s"} to go`,
        body: "Drop the final teaser now. Your coach can refine your hook — every hour from here compounds.",
      };
    case "during":
      return {
        heading: "Event day — you're live",
        body: "Post during the event. Your coach can critique a take in 30 seconds — send a draft.",
      };
    case "after":
      return {
        heading: `Post-event · ${daysFrom} day${daysFrom === 1 ? "" : "s"} ago`,
        body: `Recap window closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Draft your experience post now — one takeaway, one visual.`,
      };
    case "closed":
      return {
        heading: "Journey closed",
        body: "This event wrapped more than a week ago. The thread is read-only — a clean record of the campaign.",
      };
  }
}

function daysUntil(key: string, now: Date = new Date()): number {
  const today = startOfDay(now);
  const d = startOfDay(parseDateKey(key));
  return Math.max(0, Math.round((d.getTime() - today.getTime()) / DAY_MS));
}

function daysPast(key: string, now: Date = new Date()): number {
  const today = startOfDay(now);
  const d = startOfDay(parseDateKey(key));
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / DAY_MS));
}

export function buildJourneyPrompt(e: CreatorEvent): string {
  const dateLabel = parseDateKey(e.date).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return [
    `I'm starting an event journey for "${e.title}".`,
    ``,
    `Event date: ${dateLabel}${e.time ? ` at ${e.time} SAST` : ""}.`,
    `Venue: ${e.venue}, ${e.city}.`,
    `Category: ${e.category}.`,
    `About: ${e.description}`,
    `Why it fits: ${e.alignmentNote}`,
    ``,
    `Walk this with me as a journey, not a one-off post. I'd like:`,
    `1. A pre-event plan — teaser angles, which days to post, what format.`,
    `2. An event-day brief — what to shoot live vs. what to write up after.`,
    `3. A post-event recap plan — format, posting window, angle.`,
    ``,
    `I'll come back to this chat throughout the week. Keep our plan in mind, adjust as I send updates, and tell me clearly what to post on each specific day. Also flag anything I should AVOID posting — especially things that might read as opportunistic given how crowded this event will be.`,
  ].join("\n");
}

/** Context line injected into every coach turn so the agent always
    knows the current stage of the journey without needing to re-read
    the whole history. Sent to /api/coach-chat via its `systemHint`
    field; never shown in the chat thread itself. */
export function buildJourneyHint(
  ticket: EventTicket,
  now: Date = new Date(),
): string {
  const stage = computeStage(ticket, now);
  const daysTo = daysUntil(ticket.eventDate, now);
  const daysFrom = daysPast(ticket.eventEndDate ?? ticket.eventDate, now);

  const when =
    stage === "during"
      ? "event is happening today"
      : stage === "after"
        ? `event ended ${daysFrom} day${daysFrom === 1 ? "" : "s"} ago`
        : stage === "closed"
          ? "journey closed (read-only)"
          : `${daysTo} day${daysTo === 1 ? "" : "s"} until the event`;

  return [
    `JOURNEY CONTEXT (from the Social Assembly events system, not the user):`,
    `- Event: "${ticket.eventTitle}" at ${ticket.eventVenue}, ${ticket.eventCity}.`,
    `- Category: ${ticket.eventCategory}.`,
    `- Event date: ${ticket.eventDate}${ticket.eventEndDate ? ` → ${ticket.eventEndDate}` : ""}.`,
    `- Stage: ${stage} (${when}).`,
    `- Reply in character as a coaching agent continuing the journey plan. If the stage is "after", nudge toward the recap post. If "closed", summarise gracefully — do NOT propose new content.`,
  ].join("\n");
}

export function ticketFromEvent(e: CreatorEvent): EventTicket {
  return {
    eventId: e.id,
    eventTitle: e.title,
    eventDate: e.date,
    eventEndDate: e.endDate,
    eventCity: e.city,
    eventVenue: e.venue,
    eventCategory: e.category,
  };
}
