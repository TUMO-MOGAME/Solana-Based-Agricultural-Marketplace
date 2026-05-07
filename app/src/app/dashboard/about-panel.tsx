"use client";

import { useState } from "react";
import {
  Plus,
  TrendingUp,
  Users,
  Heart,
  Sparkles,
  CalendarDays,
  MapPin,
  ArrowUpRight,
  Eye,
  MessageCircle,
} from "lucide-react";
import styles from "./dashboard.module.css";

/*  AboutPanel — the dashboard's "About" tab.

    Shows connected social profiles one at a time: the user picks a
    platform (Instagram / TikTok / Twitter for now) and sees that
    platform's account info, performance stats, content mix, audience
    breakdown, and this week's AI coaching report.

    All data is placeholder — structured so wiring
    `/api/social/<platform>` returns the same shape is a single-file
    change. Add a new entry to PLATFORMS + PROFILES and the UI picks it
    up automatically; the "Connect another" button is the stub for the
    OAuth flow that ships later. */

/* ═════════════════════════════════════════════════════════════════
   Brand marks — inline SVGs so we don't ship the lucide versions
   (TikTok isn't in lucide; the Twitter icon there is deprecated).
   ═════════════════════════════════════════════════════════════════ */

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.07 1.645.07 4.849 0 3.205-.012 3.584-.07 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.589 6.686a4.793 4.793 0 01-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 01-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 013.183-4.51V9.4a6.329 6.329 0 00-5.394 10.692 6.33 6.33 0 0010.857-4.424V8.687a8.182 8.182 0 004.773 1.526V6.79a4.831 4.831 0 01-1.003-.104z" />
    </svg>
  );
}

function TwitterIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Platform registry — add a new entry + profile to extend to YT / LI
   ═════════════════════════════════════════════════════════════════ */

type PlatformId = "instagram" | "tiktok" | "twitter";

interface PlatformMeta {
  id: PlatformId;
  label: string;
  Icon: ({ size }: { size?: number }) => React.JSX.Element;
  accent: string; // gradient for the platform badge
}

const PLATFORMS: PlatformMeta[] = [
  {
    id: "instagram",
    label: "Instagram",
    Icon: InstagramIcon,
    accent: "linear-gradient(135deg, #833ab4, #fd1d1d 60%, #fcaf45)",
  },
  {
    id: "tiktok",
    label: "TikTok",
    Icon: TikTokIcon,
    accent: "linear-gradient(135deg, #25f4ee, #000 55%, #fe2c55)",
  },
  {
    id: "twitter",
    label: "Twitter",
    Icon: TwitterIcon,
    accent: "linear-gradient(135deg, #1da1f2, #0f172a)",
  },
];

// Platforms we don't support yet — surfaced via the "Connect another" button.
const UPCOMING_PLATFORMS: { id: string; label: string }[] = [
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
];

/* ═════════════════════════════════════════════════════════════════
   Placeholder data — shaped to match whatever the API will return.
   ═════════════════════════════════════════════════════════════════ */

interface PlatformProfile {
  handle: string;
  profileUrl: string;
  syncedAt: string; // human label
  stats: {
    followers: number;
    following: number;
    posts: number;
    engagementRate: number; // percent
    weeklyGrowth: number; // percent, can be negative
    avgLikes: number;
    reach: number; // impressions this week
  };
  contentMix: Array<{ type: string; share: number; color: string }>;
  audience: {
    topAgeRange: string;
    topAgeShare: number;
    topLocation: string;
    topLocationShare: number;
    gender: { female: number; male: number; other: number };
    interests: string[];
  };
  coaching: {
    weekOf: string;
    score: number; // 0–100
    summary: string;
    insights: Array<{
      kind: "win" | "watch" | "tip";
      title: string;
      body: string;
    }>;
    actions: string[];
  };
}

const PROFILES: Record<PlatformId, PlatformProfile> = {
  instagram: {
    handle: "@emma.matlhaga",
    profileUrl: "https://instagram.com/emma.matlhaga",
    syncedAt: "Synced 2 min ago",
    stats: {
      followers: 45_200,
      following: 812,
      posts: 1_243,
      engagementRate: 3.8,
      weeklyGrowth: 2.1,
      avgLikes: 1_204,
      reach: 128_400,
    },
    contentMix: [
      { type: "Reels", share: 45, color: "linear-gradient(135deg, #ff7b6b, #ffb86b)" },
      { type: "Carousels", share: 25, color: "linear-gradient(135deg, #ffb86b, #f6e27f)" },
      { type: "Posts", share: 18, color: "linear-gradient(135deg, #c086ff, #ff7b6b)" },
      { type: "Stories", share: 12, color: "linear-gradient(135deg, #8dd6ff, #c086ff)" },
    ],
    audience: {
      topAgeRange: "18–24",
      topAgeShare: 47,
      topLocation: "Johannesburg, ZA",
      topLocationShare: 32,
      gender: { female: 64, male: 35, other: 1 },
      interests: ["Fashion", "Music", "Food", "Travel", "Beauty"],
    },
    coaching: {
      weekOf: "Apr 12 – Apr 18",
      score: 78,
      summary:
        "Strong week on Reels. Your hooks are landing, but carousel retention drops on slide 2 — lead with a stronger visual.",
      insights: [
        {
          kind: "win",
          title: "Reels hooks are working",
          body: "3 of 5 Reels this week used a cold-open question in the first 2s. Retention at 3s averaged 72%, +14% vs your baseline.",
        },
        {
          kind: "watch",
          title: "Carousel slide 2 drop-off",
          body: "40% of viewers bounced on slide 2 across your three carousels. Your text-heavy second slide is the culprit.",
        },
        {
          kind: "tip",
          title: "Shift your posting window",
          body: "Your audience engaged 2.3× more at 19:00 SAST than 14:00 SAST. Move the next two Reels into the evening slot.",
        },
      ],
      actions: [
        "Rework slide 2 on next carousel — lead with a bold visual, save the copy for slide 3.",
        "Schedule two Reels for 19:00 SAST this week.",
        "Save captions from your 3 best-performing Reels — reuse the hook formula.",
      ],
    },
  },
  tiktok: {
    handle: "@emmasocial",
    profileUrl: "https://tiktok.com/@emmasocial",
    syncedAt: "Synced 14 min ago",
    stats: {
      followers: 92_800,
      following: 164,
      posts: 287,
      engagementRate: 6.4,
      weeklyGrowth: 4.7,
      avgLikes: 5_860,
      reach: 412_900,
    },
    contentMix: [
      { type: "Short videos", share: 78, color: "linear-gradient(135deg, #fe2c55, #25f4ee)" },
      { type: "Lives", share: 14, color: "linear-gradient(135deg, #25f4ee, #8dd6ff)" },
      { type: "Photo slides", share: 8, color: "linear-gradient(135deg, #ffb86b, #fe2c55)" },
    ],
    audience: {
      topAgeRange: "16–22",
      topAgeShare: 58,
      topLocation: "South Africa",
      topLocationShare: 54,
      gender: { female: 57, male: 41, other: 2 },
      interests: ["Dance", "Comedy", "Lifestyle", "Food", "Trends"],
    },
    coaching: {
      weekOf: "Apr 12 – Apr 18",
      score: 86,
      summary:
        "Big growth week — your FYP placement is up. First 1.5 seconds are your lever; double down on cold-open visuals.",
      insights: [
        {
          kind: "win",
          title: "FYP push is strong",
          body: "Your 412k reach is the highest in 8 weeks. Two videos crossed 80k views — both used on-screen text as the hook.",
        },
        {
          kind: "watch",
          title: "Longer videos under-performing",
          body: "Videos >45s had 48% watch-through; under-30s sat at 71%. The algorithm is favouring tight cuts this week.",
        },
        {
          kind: "tip",
          title: "Ride the #sasecretfoodie wave",
          body: "The tag is up 220% in your niche locally. One themed video could unlock an extra 30–50k views.",
        },
      ],
      actions: [
        "Cut your next three videos to ≤30s.",
        "Lead every video with a 1.5s visual hook — skip the voiceover intro.",
        "Film one #sasecretfoodie-tagged video this week.",
      ],
    },
  },
  twitter: {
    handle: "@emma_sa",
    profileUrl: "https://twitter.com/emma_sa",
    syncedAt: "Synced 1 hour ago",
    stats: {
      followers: 8_420,
      following: 542,
      posts: 3_182,
      engagementRate: 1.9,
      weeklyGrowth: -0.4,
      avgLikes: 62,
      reach: 34_700,
    },
    contentMix: [
      { type: "Tweets", share: 62, color: "linear-gradient(135deg, #1da1f2, #c086ff)" },
      { type: "Replies", share: 20, color: "linear-gradient(135deg, #8dd6ff, #1da1f2)" },
      { type: "Quote tweets", share: 12, color: "linear-gradient(135deg, #c086ff, #ff7b6b)" },
      { type: "Media", share: 6, color: "linear-gradient(135deg, #ffb86b, #8dd6ff)" },
    ],
    audience: {
      topAgeRange: "25–34",
      topAgeShare: 42,
      topLocation: "Cape Town, ZA",
      topLocationShare: 28,
      gender: { female: 44, male: 54, other: 2 },
      interests: ["Tech", "Politics", "Business", "Sports", "Media"],
    },
    coaching: {
      weekOf: "Apr 12 – Apr 18",
      score: 64,
      summary:
        "Flat week — follower count held but engagement dipped. Your quote-tweets drive more follows than originals; lean into threads.",
      insights: [
        {
          kind: "win",
          title: "Quote-tweets convert followers",
          body: "Your 4 quote-tweets this week pulled 47% of your new follows despite being 12% of output. Format matters here.",
        },
        {
          kind: "watch",
          title: "Long-form tweets are flat",
          body: "Single-tweet essays (>220 chars) drove 0.4% engagement vs 2.1% for threads. Break long ideas into 3–5 tweets.",
        },
        {
          kind: "tip",
          title: "Tuesday 20:00 SAST is your window",
          body: "Your top 3 tweets this quarter all landed Tuesday evening. Queue your next big idea for that slot.",
        },
      ],
      actions: [
        "Turn your next long tweet into a 4-tweet thread.",
        "Queue your strongest draft for Tuesday 20:00 SAST.",
        "Quote-tweet two pieces of news in your niche this week.",
      ],
    },
  },
};

/* ═════════════════════════════════════════════════════════════════
   Helpers
   ═════════════════════════════════════════════════════════════════ */

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const cx = (...parts: Array<string | false | undefined | null>) =>
  parts.filter(Boolean).join(" ");

/* ═════════════════════════════════════════════════════════════════
   Root component
   ═════════════════════════════════════════════════════════════════ */

export default function AboutPanel({
  user,
}: {
  user: { name: string; email: string; avatar: string };
}) {
  const [platformId, setPlatformId] = useState<PlatformId>("instagram");
  const [addOpen, setAddOpen] = useState(false);

  const platform = PLATFORMS.find((p) => p.id === platformId) ?? PLATFORMS[0];
  const profile = PROFILES[platformId];

  return (
    <div className={styles.aboutContainer}>
      <PlatformSelector
        active={platformId}
        onChange={setPlatformId}
        addOpen={addOpen}
        onToggleAdd={() => setAddOpen((v) => !v)}
      />

      <div className={styles.aboutGrid}>
        <AccountCard platform={platform} profile={profile} user={user} />
        <StatsCard stats={profile.stats} />
        <ContentMixCard mix={profile.contentMix} />
        <AudienceCard audience={profile.audience} />
        <WeeklyReportCard report={profile.coaching} platform={platform} />
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Sub-components
   ═════════════════════════════════════════════════════════════════ */

function PlatformSelector({
  active,
  onChange,
  addOpen,
  onToggleAdd,
}: {
  active: PlatformId;
  onChange: (id: PlatformId) => void;
  addOpen: boolean;
  onToggleAdd: () => void;
}) {
  return (
    <div className={styles.platformBar}>
      <div className={styles.platformTabs} role="tablist">
        {PLATFORMS.map((p) => {
          const Icon = p.Icon;
          const isActive = active === p.id;
          return (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              className={cx(
                styles.platformTab,
                isActive && styles.platformTabActive
              )}
              onClick={() => onChange(p.id)}
            >
              <span
                className={styles.platformTabIcon}
                style={{ background: p.accent }}
              >
                <Icon size={12} />
              </span>
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.platformAddWrap}>
        <button
          type="button"
          className={styles.platformAddBtn}
          onClick={onToggleAdd}
          aria-expanded={addOpen}
        >
          <Plus />
          <span>Connect another</span>
        </button>
        {addOpen ? (
          <div className={styles.platformAddPopover}>
            <div className={styles.platformAddTitle}>Coming soon</div>
            <p className={styles.platformAddBody}>
              We&apos;re wiring the OAuth handshakes for these next. Drop a
              note to Emma if you want one prioritised.
            </p>
            <ul className={styles.platformAddList}>
              {UPCOMING_PLATFORMS.map((p) => (
                <li key={p.id}>{p.label}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AccountCard({
  platform,
  profile,
  user,
}: {
  platform: PlatformMeta;
  profile: PlatformProfile;
  user: { name: string; avatar: string };
}) {
  const Icon = platform.Icon;
  return (
    <section className={cx(styles.box, styles.accountCard)}>
      <header className={styles.accountHeader}>
        <div
          className={styles.platformBadge}
          style={{ background: platform.accent }}
          aria-hidden="true"
        >
          <Icon size={20} />
        </div>
        <div className={styles.accountMeta}>
          <h3 className={styles.accountHandle}>{profile.handle}</h3>
          <div className={styles.accountSub}>
            <span className={styles.accountDot} /> Connected
            <span className={styles.accountDivider} aria-hidden="true" />
            {profile.syncedAt}
          </div>
        </div>
        <a
          className={styles.accountLink}
          href={profile.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${profile.handle} on ${platform.label}`}
        >
          <ArrowUpRight />
        </a>
      </header>

      <div className={styles.accountStatsRow}>
        <div className={styles.accountStat}>
          <span className={styles.accountStatValue}>
            {formatCount(profile.stats.followers)}
          </span>
          <span className={styles.accountStatLabel}>Followers</span>
        </div>
        <div className={styles.accountStat}>
          <span className={styles.accountStatValue}>
            {formatCount(profile.stats.following)}
          </span>
          <span className={styles.accountStatLabel}>Following</span>
        </div>
        <div className={styles.accountStat}>
          <span className={styles.accountStatValue}>
            {formatCount(profile.stats.posts)}
          </span>
          <span className={styles.accountStatLabel}>Posts</span>
        </div>
      </div>

      <footer className={styles.accountFooter}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatar} alt={user.name} className={styles.accountOwner} />
        <span>
          Reporting for <strong>{user.name}</strong>
        </span>
      </footer>
    </section>
  );
}

function StatsCard({ stats }: { stats: PlatformProfile["stats"] }) {
  const growthUp = stats.weeklyGrowth >= 0;
  const tiles: Array<{
    label: string;
    value: string;
    Icon: typeof Heart;
    accent?: string;
  }> = [
    {
      label: "Engagement",
      value: `${stats.engagementRate}%`,
      Icon: Heart,
    },
    {
      label: "Weekly growth",
      value: `${growthUp ? "+" : ""}${stats.weeklyGrowth}%`,
      Icon: TrendingUp,
      accent: growthUp ? "up" : "down",
    },
    {
      label: "Avg likes",
      value: formatCount(stats.avgLikes),
      Icon: Heart,
    },
    {
      label: "Reach",
      value: formatCount(stats.reach),
      Icon: Eye,
    },
  ];

  return (
    <section className={cx(styles.box)}>
      <header className={styles.boxHeader}>
        <h3 className={styles.boxTitle}>Performance</h3>
        <span className={styles.boxLabel}>This week</span>
      </header>
      <div className={styles.statsGrid}>
        {tiles.map((t) => (
          <div key={t.label} className={styles.statTile}>
            <span
              className={cx(
                styles.statTileIcon,
                t.accent === "up" && styles.statTileUp,
                t.accent === "down" && styles.statTileDown
              )}
            >
              <t.Icon />
            </span>
            <span className={styles.statTileValue}>{t.value}</span>
            <span className={styles.statTileLabel}>{t.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContentMixCard({
  mix,
}: {
  mix: PlatformProfile["contentMix"];
}) {
  return (
    <section className={cx(styles.box)}>
      <header className={styles.boxHeader}>
        <h3 className={styles.boxTitle}>Content mix</h3>
        <span className={styles.boxLabel}>Last 30 posts</span>
      </header>
      <div className={styles.mixList}>
        {mix.map((m) => (
          <div key={m.type} className={styles.mixRow}>
            <span className={styles.mixLabel}>{m.type}</span>
            <div className={styles.mixBar}>
              <div
                className={styles.mixBarFill}
                style={{ width: `${m.share}%`, background: m.color }}
              />
            </div>
            <span className={styles.mixShare}>{m.share}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AudienceCard({
  audience,
}: {
  audience: PlatformProfile["audience"];
}) {
  const { female, male, other } = audience.gender;
  return (
    <section className={cx(styles.box)}>
      <header className={styles.boxHeader}>
        <h3 className={styles.boxTitle}>Audience</h3>
        <span className={styles.boxLabel}>Who&apos;s watching</span>
      </header>
      <div className={styles.boxBody}>
        <div className={styles.audienceRow}>
          <CalendarDays />
          <span>
            Top age range&nbsp;
            <strong>
              {audience.topAgeRange} ({audience.topAgeShare}%)
            </strong>
          </span>
        </div>
        <div className={styles.audienceRow}>
          <MapPin />
          <span>
            Top location&nbsp;
            <strong>
              {audience.topLocation} ({audience.topLocationShare}%)
            </strong>
          </span>
        </div>

        <div className={styles.genderBar}>
          <div
            className={styles.genderSlice}
            style={{
              width: `${female}%`,
              background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
            }}
            title={`Women ${female}%`}
          />
          <div
            className={styles.genderSlice}
            style={{
              width: `${male}%`,
              background: "linear-gradient(135deg, #8dd6ff, #c086ff)",
            }}
            title={`Men ${male}%`}
          />
          <div
            className={styles.genderSlice}
            style={{
              width: `${other}%`,
              background: "linear-gradient(135deg, #f6e27f, #ffb86b)",
            }}
            title={`Non-binary ${other}%`}
          />
        </div>
        <div className={styles.genderLegend}>
          <span>Women {female}%</span>
          <span>Men {male}%</span>
          <span>Non-binary {other}%</span>
        </div>

        <div className={styles.interestTags}>
          {audience.interests.map((i) => (
            <span key={i} className={styles.interestTag}>
              {i}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function WeeklyReportCard({
  report,
  platform,
}: {
  report: PlatformProfile["coaching"];
  platform: PlatformMeta;
}) {
  const Icon = platform.Icon;
  return (
    <section className={cx(styles.box, styles.reportCard)}>
      <header className={styles.reportHeader}>
        <div className={styles.reportCoach}>
          <span className={styles.reportCoachAvatar}>
            <Sparkles />
          </span>
          <div>
            <h3 className={styles.reportTitle}>This week&apos;s coaching report</h3>
            <div className={styles.reportSub}>
              <span
                className={styles.reportSubBadge}
                style={{ background: platform.accent }}
              >
                <Icon size={10} />
              </span>
              {platform.label} · {report.weekOf}
            </div>
          </div>
        </div>
        <div className={styles.reportScore}>
          <div className={styles.reportScoreValue}>{report.score}</div>
          <div className={styles.reportScoreLabel}>Weekly score</div>
        </div>
      </header>

      <p className={styles.reportSummary}>{report.summary}</p>

      <div className={styles.reportInsights}>
        {report.insights.map((ins, i) => (
          <div
            key={i}
            className={cx(
              styles.reportInsight,
              ins.kind === "win" && styles.reportInsightWin,
              ins.kind === "watch" && styles.reportInsightWatch,
              ins.kind === "tip" && styles.reportInsightTip
            )}
          >
            <div className={styles.reportInsightKind}>
              {ins.kind === "win" ? "Win" : ins.kind === "watch" ? "Watch out" : "Tip"}
            </div>
            <h4 className={styles.reportInsightTitle}>{ins.title}</h4>
            <p className={styles.reportInsightBody}>{ins.body}</p>
          </div>
        ))}
      </div>

      <div className={styles.reportActions}>
        <h4 className={styles.reportActionsTitle}>
          <MessageCircle />
          Action items this week
        </h4>
        <ul className={styles.reportActionsList}>
          {report.actions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </div>

      <button type="button" className={styles.reportCTA}>
        Get the full report
        <ArrowUpRight />
      </button>
    </section>
  );
}
