/* Shared types + fallback data for the "Daily trend alerts" feed.
   Imported by:
     - src/app/api/trend-alerts/route.ts   (server — calls the Researcher
       agent via A2A and returns these samples when the agent is offline)
     - src/app/dashboard/notifications-panel.tsx  (client — renders them)

   The panel fetches /api/trend-alerts on mount; the route returns
   either a `live` payload (parsed from the Researcher) or a `sample`
   payload (this constant). Keep this file small — it is the fallback,
   not the source of truth. */

export type TrendNotificationSource = "live" | "sample";

export interface TrendNotification {
  id: string;
  agent: "coaching";
  agentLabel: string;
  time: string;
  trend: string;
  platform: string;
  region: string;
  about: string;
  howToJoin: string;
  score?: number;
}

export interface TrendAlertsPayload {
  source: TrendNotificationSource;
  generatedAt: string;
  notifications: TrendNotification[];
  reason?: string;
}

export const FALLBACK_NOTIFICATIONS: TrendNotification[] = [
  {
    id: "n-hook-3s",
    agent: "coaching",
    agentLabel: "Content Coach",
    time: "2h ago",
    trend: "3-Second Hook Challenge",
    platform: "TikTok",
    region: "South Africa + global",
    about:
      "Creators are opening videos with a single declarative line over a static frame, then cutting hard to the payoff. Watch-time on the first 3 seconds is averaging 92% for posts using this pattern.",
    howToJoin:
      "Pick one strong belief from your niche, film a static close-up saying it, then jump-cut straight into your main content. Keep total length under 45s and pin a comment with the belief as a hook.",
  },
  {
    id: "n-dayinthelife",
    agent: "coaching",
    agentLabel: "Content Coach",
    time: "5h ago",
    trend: "60-Second Day-in-the-Life edit",
    platform: "Instagram Reels",
    region: "Johannesburg + Cape Town",
    about:
      "Founder-style 'day in the life' reels are outperforming polished content 3:1 this week. The winning edit is 8–10 clips under 6 seconds each, lo-fi audio, one overlay caption per scene.",
    howToJoin:
      "Film tomorrow in bursts: wake-up, first task, a problem, a win, an end-of-day reflection. Stitch them with Reels' native editor and use a trending slow-tempo audio under -14 LUFS.",
  },
  {
    id: "n-unfiltered-audio",
    agent: "coaching",
    agentLabel: "Content Coach",
    time: "Yesterday",
    trend: "Unfiltered Morning audio trend",
    platform: "TikTok",
    region: "Global (Africa index rising)",
    about:
      "A soft-spoken audio is being used over unedited, one-take morning footage. Engagement is skewed to creators who show *friction* — skipped alarms, burnt toast — rather than idealised routines.",
    howToJoin:
      "Record a 35-second single-take clip tomorrow morning with the trending audio as the only sound. Show one honest imperfection. Post before 08:00 SAST to ride the algorithmic push.",
  },
  {
    id: "n-creator-monologue",
    agent: "coaching",
    agentLabel: "Content Coach",
    time: "Today",
    trend: "Creator Monologue format",
    platform: "Instagram Reels + YouTube Shorts",
    region: "South Africa",
    about:
      "Long-form creators are posting 50-second talking-head monologues arguing one contrarian take. Completion rates are 68%+ because the hook promises a single, sharp conclusion.",
    howToJoin:
      "Write a 90-word script: 1 contrarian claim, 3 reasons, 1 call to action. Film in one take against a plain wall, burn captions in, and title the post with the claim verbatim.",
  },
];

export function buildCoachPrompt(n: TrendNotification): string {
  return [
    `Hi — I got a daily trend alert from you about the "${n.trend}" trend.`,
    ``,
    `Where it's happening: ${n.platform} (${n.region}).`,
    `What it is: ${n.about}`,
    `Your suggested way in: ${n.howToJoin}`,
    ``,
    `Can you walk me through why this fits my content, break down the steps in more detail, and help me shape my next post so I can actually gain followers from it?`,
  ].join("\n");
}
