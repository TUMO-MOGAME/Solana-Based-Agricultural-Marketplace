/* Shared types + fallback data for the Events tab.

   Imported by:
     - src/app/api/events/route.ts           (server — will call a real
       events API later; for now returns these samples)
     - src/app/dashboard/events-panel.tsx    (client — renders them)

   `aligned` marks events that fit the creator's content niche (founder /
   social-media-strategy / SA creator economy). The UI highlights aligned
   events with the accent colour and the coach's seeded prompt shifts
   from "how to ride this event" (aligned) to "should I engage at all"
   (not aligned). When we wire a real API later, classification can come
   from either the API payload or a light LLM pass — this shape keeps
   either option cheap. */

export type EventCategory =
  | "Creator Economy"
  | "Tech / Startups"
  | "Fintech"
  | "Design"
  | "Media"
  | "Music"
  | "Film"
  | "Sports"
  | "Lifestyle";

export type EventSource = "live" | "sample";

export interface CreatorEvent {
  id: string;
  title: string;
  /** ISO date (date-only), e.g. "2026-04-25". */
  date: string;
  /** ISO date for multi-day events; omitted if single-day. */
  endDate?: string;
  /** Optional start time, e.g. "18:00" (SAST). */
  time?: string;
  venue: string;
  city: string;
  category: EventCategory;
  description: string;
  website?: string;
  /** True when the event fits the creator's niche. Drives colouring. */
  aligned: boolean;
  /** One-liner the coach can quote back — why it's a fit or why it isn't. */
  alignmentNote: string;
  tags: string[];
}

export interface EventsPayload {
  source: EventSource;
  generatedAt: string;
  events: CreatorEvent[];
  reason?: string;
}

/* ~12 SA events spread over the next ~10 weeks. Mix of aligned (creator
   / tech / fintech / design) and not-aligned (music / sports / lifestyle)
   so the UI can demonstrate both the accent-highlight and the "warning"
   coach flow. Dates assume a 2026-04 anchor (see memory/MEMORY.md's
   currentDate). Update quarterly. */
export const FALLBACK_EVENTS: CreatorEvent[] = [
  {
    id: "ev-creator-summit-sa",
    title: "Creator Economy Summit SA",
    date: "2026-04-25",
    time: "09:00",
    venue: "Sandton Convention Centre",
    city: "Johannesburg",
    category: "Creator Economy",
    description:
      "Two-day gathering of South African creators, platform leads, and brand marketers focused on monetisation, IP, and cross-platform strategy. Keynote from the YouTube SA lead; workshops on short-form editing and sponsor negotiation.",
    website: "https://creatoreconomysa.co.za",
    aligned: true,
    alignmentNote:
      "Sits at the centre of your content pillar. Attending creators are exactly your audience.",
    tags: ["creators", "monetisation", "networking"],
  },
  {
    id: "ev-design-indaba",
    title: "The Design Indaba Festival",
    date: "2026-04-28",
    endDate: "2026-04-30",
    venue: "Artscape Theatre Centre",
    city: "Cape Town",
    category: "Design",
    description:
      "Three-day festival of design thinking, creative direction, and cultural commentary. Strong overlap with founder and creative-director audiences.",
    website: "https://designindaba.com",
    aligned: true,
    alignmentNote:
      "Design Indaba's founder-story tracks double as social-media strategy case studies — easy content angle.",
    tags: ["design", "founders", "storytelling"],
  },
  {
    id: "ev-startup-grind-jhb",
    title: "Startup Grind Johannesburg — Founder Night",
    date: "2026-04-30",
    time: "18:30",
    venue: "Workshop17, Rosebank",
    city: "Johannesburg",
    category: "Tech / Startups",
    description:
      "Monthly fireside with two Johannesburg founders sharing the one call that nearly killed their company and how they recovered.",
    website: "https://startupgrind.com/johannesburg",
    aligned: true,
    alignmentNote:
      "Founder-journey stories are perfect raw material for your building-in-public pillar.",
    tags: ["founders", "building-in-public", "johannesburg"],
  },
  {
    id: "ev-ct-jazz-fest",
    title: "Cape Town International Jazz Festival",
    date: "2026-05-01",
    endDate: "2026-05-02",
    venue: "Cape Town ICC",
    city: "Cape Town",
    category: "Music",
    description:
      "Two-day flagship jazz festival with a 30+ artist lineup. One of the largest annual cultural events in South Africa.",
    website: "https://capetownjazzfest.com",
    aligned: false,
    alignmentNote:
      "High cultural visibility but no obvious creator / founder angle — engaging without a take risks feeling generic.",
    tags: ["culture", "music", "lifestyle"],
  },
  {
    id: "ev-digital-africa",
    title: "Digital Africa Conference",
    date: "2026-05-02",
    time: "09:00",
    venue: "CTICC 2",
    city: "Cape Town",
    category: "Tech / Startups",
    description:
      "Continental summit on Africa's digital economy — payments, platforms, and creator monetisation across 12 markets.",
    website: "https://digitalafrica.co",
    aligned: true,
    alignmentNote:
      "Cross-market creator monetisation is a content goldmine. Speakers here are citable authority for future posts.",
    tags: ["africa", "tech", "monetisation"],
  },
  {
    id: "ev-durban-film",
    title: "iLoveFilm Pitch Week (Durban)",
    date: "2026-05-08",
    endDate: "2026-05-10",
    venue: "Suncoast Casino",
    city: "Durban",
    category: "Film",
    description:
      "Documentary and short-form pitch week bringing together independent SA filmmakers and streaming commissioners.",
    aligned: false,
    alignmentNote:
      "Adjacent to your craft but audience is film-industry, not creators. Attend only if you want to pivot a pillar.",
    tags: ["film", "documentary", "durban"],
  },
  {
    id: "ev-miss-sa",
    title: "Miss South Africa Finale",
    date: "2026-05-10",
    time: "19:00",
    venue: "Sun City Superbowl",
    city: "Sun City",
    category: "Lifestyle",
    description:
      "Live crowning of Miss South Africa 2026 — televised nationally with a peak audience of ~3M viewers.",
    aligned: false,
    alignmentNote:
      "Huge reach but politically sensitive and style-heavy. Engage only with a sharp, values-driven angle — neutral takes get lost.",
    tags: ["pageant", "broadcast", "national"],
  },
  {
    id: "ev-tedx-jhb",
    title: "TEDxJohannesburg 2026",
    date: "2026-05-15",
    time: "14:00",
    venue: "The Market Theatre",
    city: "Johannesburg",
    category: "Creator Economy",
    description:
      "Curated day of ideas from South African founders, activists, and researchers. Theme for 2026: 'Unreasonable Optimism'.",
    website: "https://tedxjohannesburg.co.za",
    aligned: true,
    alignmentNote:
      "TEDx talks age well as reference material; quoting speakers gives your posts authority.",
    tags: ["ideas", "founders", "keynotes"],
  },
  {
    id: "ev-fintech-africa",
    title: "Fintech Africa Summit",
    date: "2026-05-18",
    endDate: "2026-05-19",
    venue: "Century City Conference Centre",
    city: "Cape Town",
    category: "Fintech",
    description:
      "Flagship fintech event drawing 1,800+ delegates across payments, lending, and crypto regulation.",
    website: "https://fintechafricasummit.com",
    aligned: true,
    alignmentNote:
      "Fintech founder-stories cross over directly with your monetisation + building-in-public content.",
    tags: ["fintech", "founders", "payments"],
  },
  {
    id: "ev-africa-com",
    title: "AfricaCom 2026",
    date: "2026-05-22",
    endDate: "2026-05-24",
    venue: "CTICC",
    city: "Cape Town",
    category: "Tech / Startups",
    description:
      "Africa's largest telecoms + digital infrastructure event — creator-platform distribution deals are often announced here.",
    website: "https://africatechfestival.com",
    aligned: true,
    alignmentNote:
      "Reporting platform news first makes you a go-to source in your niche — easy evergreen content.",
    tags: ["telecoms", "platforms", "announcements"],
  },
  {
    id: "ev-smw-jhb",
    title: "Social Media Week Johannesburg",
    date: "2026-06-05",
    endDate: "2026-06-07",
    venue: "Various, Rosebank",
    city: "Johannesburg",
    category: "Creator Economy",
    description:
      "Three-day run of workshops, panels, and networking focused on paid + organic social, with strong creator-track programming.",
    website: "https://socialmediaweek.org",
    aligned: true,
    alignmentNote:
      "This IS your content pillar on location. Every hallway conversation is a post. Block the full run.",
    tags: ["social-media", "creators", "workshops"],
  },
  {
    id: "ev-comrades",
    title: "Comrades Marathon",
    date: "2026-06-08",
    time: "05:30",
    venue: "Pietermaritzburg → Durban",
    city: "KwaZulu-Natal",
    category: "Sports",
    description:
      "90km ultra-marathon between Pietermaritzburg and Durban. One of the largest ultra-marathons in the world.",
    website: "https://comrades.com",
    aligned: false,
    alignmentNote:
      "National pride but no credible creator / founder angle from you — cheap engagement posts will feel opportunistic.",
    tags: ["sports", "ultramarathon", "national"],
  },
];

export function buildEventCoachPrompt(e: CreatorEvent): string {
  const dateLabel = new Date(e.date).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const shared = [
    `I'm looking at an upcoming South African event: "${e.title}".`,
    ``,
    `When: ${dateLabel}${e.time ? ` at ${e.time} SAST` : ""}.`,
    `Where: ${e.venue}, ${e.city}.`,
    `Category: ${e.category}.`,
    `About: ${e.description}`,
    ``,
  ];

  if (e.aligned) {
    return [
      ...shared,
      `Your earlier alignment note: "${e.alignmentNote}"`,
      ``,
      `Can you help me plan content around this event? Specifically:`,
      `1. What should I post BEFORE the event to build interest (hook angle + format)?`,
      `2. What's the single best content type to shoot DURING the event itself?`,
      `3. How do I follow up AFTER it wraps so the momentum doesn't die?`,
      `4. What specifically should I AVOID — because with high interest everyone else will be posting the obvious stuff?`,
      `Please walk me through it as a week-by-week plan so I can commit to a journey, not a one-off post.`,
    ].join("\n");
  }

  return [
    ...shared,
    `Your earlier alignment note: "${e.alignmentNote}"`,
    ``,
    `Be honest with me — should I engage with this event at all?`,
    `If you think I should skip it, tell me why and what followers of mine might lose trust in if I posted a generic take.`,
    `If there IS an angle I could own authentically, what would it look like, and what would I need to avoid saying to protect my credibility?`,
  ].join("\n");
}

/* Month key helpers — used by the calendar view to bucket events. */
export function eventMonthKey(e: CreatorEvent): string {
  // YYYY-MM
  return e.date.slice(0, 7);
}

export function eventDateKey(e: CreatorEvent): string {
  return e.date;
}
