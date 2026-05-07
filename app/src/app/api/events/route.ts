import { NextResponse } from "next/server";
import {
  FALLBACK_EVENTS,
  EventsPayload,
} from "@/app/dashboard/events-data";

/*  GET /api/events — SA events feed for the dashboard Events tab.

    Currently returns FALLBACK_EVENTS (see src/app/dashboard/events-data.ts)
    as `source: "sample"`. This route exists so the UI has an API seam
    ready for when we wire a real source — candidates:

      • Eventbrite Search API (free tier, has SA filter)
      • Quicket public events (SA-native, needs screen-scrape)
      • A hand-curated Supabase table the team updates weekly

    Response shape matches /api/trend-alerts so the client contract stays
    uniform:
      { source: "live" | "sample", generatedAt, events[], reason? }

    When a live source is wired, mirror the trend-alerts route: try the
    live call, fall back to FALLBACK_EVENTS on any error, cache success
    in-memory for a few hours (events change slowly). */

export const dynamic = "force-dynamic";

export async function GET() {
  const payload: EventsPayload = {
    source: "sample",
    generatedAt: new Date().toISOString(),
    events: FALLBACK_EVENTS,
    reason: "Live events feed not wired yet — showing curated sample.",
  };
  return NextResponse.json(payload);
}
