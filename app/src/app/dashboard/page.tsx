"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Home,
  PlusCircle,
  TrendingUp,
  Image as ImageIcon,
  CalendarDays,
  Bell,
  Mail,
  Search,
  Menu,
  PanelRight,
  Briefcase,
  MapPin,
  Sparkles,
  LogOut,
} from "lucide-react";
import SessionChat from "./session-chat";
import SessionsList from "./sessions-list";
import { SessionsProvider, useSessions } from "./sessions-context";
import NotificationsPanel from "./notifications-panel";
import AboutPanel from "./about-panel";
import EventsPanel from "./events-panel";
import ArtifactPanel from "../artifact-panel";
import { ArtifactProvider, useArtifact } from "../artifact-context";
import VideoPanel from "./video-panel";
import { ExemplarProvider, useExemplar } from "./exemplar-context";
import JourneyPanel from "./journey-panel";
import { JourneyProvider, useJourney } from "./journey-context";
import { useUnreadNotifications } from "./use-unread-notifications";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import PipelinePanel from "./pipeline-panel";
import { PipelineProvider, usePipeline } from "./pipeline-context";
import "../style.css";
import styles from "./dashboard.module.css";

type ProfileTab = "timeline" | "about" | "media" | "events";

const PROFILE_TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: "timeline", label: "Timeline" },
  { id: "about", label: "About" },
  { id: "media", label: "Media" },
  { id: "events", label: "Events" },
];

/* ─── Placeholder content — all hard-coded for Phase 1. Phase 2 wires these
   to real session/creator/activity data. Keep stubs obvious and neutral. ─── */

const FALLBACK_USER = {
  name: "Emma Matlhaga",
  email: "emma.m.strategy@gmail.com",
  avatar: "/content_creator.webp",
};

type DashUser = { name: string; email: string; avatar: string };

/* ─── Provider wrapper — hydrates the user from the live Supabase auth
       session (NOT sessionStorage, which login doesn't write to). Subscribes
       to onAuthStateChange so sign-in/sign-out flips the dashboard's idea
       of "who's signed in" without a refresh. If there's no session we
       redirect to /login rather than rendering with a fallback identity —
       that misroute was the root cause of writes landing under the wrong
       email when accounts were swapped. ─── */
function DashboardProviders() {
  const router = useRouter();
  const [user, setUser] = useState<DashUser | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let mounted = true;

    const userFromSupabase = (
      authUser: { email?: string | null; user_metadata?: Record<string, unknown> } | null,
    ): DashUser | null => {
      const email = authUser?.email?.trim();
      if (!email) return null;
      const meta = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
      const fullName =
        typeof meta.full_name === "string"
          ? meta.full_name
          : typeof meta.name === "string"
          ? meta.name
          : null;
      const avatar =
        typeof meta.avatar_url === "string" ? meta.avatar_url : FALLBACK_USER.avatar;
      const fallbackName =
        email.split("@")[0]?.replace(/[._-]+/g, " ") || email;
      return {
        name: fullName || fallbackName,
        email,
        avatar,
      };
    };

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const next = userFromSupabase(data.user);
      if (!next) {
        router.replace("/login");
        return;
      }
      setUser(next);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        const next = userFromSupabase(session?.user ?? null);
        if (!next) {
          router.replace("/login");
        } else {
          setUser(next);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  if (!user) {
    // Brief blank state while the session resolves. SessionsProvider
    // requires a stable userEmail, so we don't mount it until then.
    return null;
  }

  return (
    <SessionsProvider userEmail={user.email}>
      <DashboardInner user={user} />
    </SessionsProvider>
  );
}

/* ─── Inner shell (needs artifact + sessions context) ─── */
function DashboardInner({ user }: { user: DashUser }) {
  const router = useRouter();
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("timeline");
  const { artifact, closeArtifact, isOpen: artifactOpen } = useArtifact();
  const { isOpen: exemplarOpen } = useExemplar();
  const { isOpen: journeyOpen } = useJourney();
  const { isOpen: pipelineOpen, openRun: openPipelineRun } = usePipeline();
  const {
    isChatOpen,
    openChat,
    closeChat,
    newSession,
    startSessionFromNotification,
  } = useSessions();
  const [notifOpen, setNotifOpen] = useState(false);
  const { count: unreadCount, refresh: refreshUnread } = useUnreadNotifications();

  const closeDrawers = () => {
    setLeftOpen(false);
    setRightOpen(false);
  };

  const handleLogout = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      /* offline / Supabase unreachable — fall through to the redirect */
    }
    try {
      sessionStorage.removeItem("sa.user");   // legacy crumb — clear it too
    } catch { /* private mode */ }
    router.push("/login");
  };

  const firstName = user.name.split(" ")[0] ?? user.name;

  // Every top-level navigation goes through this so chat mode exits and
  // the mobile drawers close in one place. Prevents the "stuck in chat"
  // bug where clicking Home with the chat open did nothing.
  const goToTab = (tab: ProfileTab) => {
    closeChat();
    setProfileTab(tab);
    closeDrawers();
  };

  const startNewSession = () => {
    newSession();
    openChat();
    closeDrawers();
  };

  const navItems = [
    {
      icon: Home,
      label: "Home",
      active: !isChatOpen && profileTab === "timeline",
      onClick: () => goToTab("timeline"),
    },
    {
      icon: PlusCircle,
      label: "New Session",
      active: isChatOpen,
      onClick: startNewSession,
    },
    {
      icon: ImageIcon,
      label: "Media",
      active: !isChatOpen && profileTab === "media",
      onClick: () => goToTab("media"),
    },
    {
      icon: CalendarDays,
      label: "Events",
      active: !isChatOpen && profileTab === "events",
      onClick: () => goToTab("events"),
    },
  ];

  return (
    <div className={styles.container}>
      {/* ═══════════════════════════════════════════════════════════════
          Left sidebar — Social Assembly logo, nav, coaches
          ═══════════════════════════════════════════════════════════════ */}
      <aside
        className={`${styles.leftSide} ${leftOpen ? styles.active : ""}`}
        aria-label="Primary navigation"
      >
        <button
          type="button"
          className={styles.logo}
          onClick={() => goToTab("timeline")}
          aria-label="Social Assembly — go to home"
        >
          <div className={styles.logoMark}>SA</div>
          <div className={styles.logoText}>
            Social Assembly
            <em>Creator Studio</em>
          </div>
        </button>

        <div className={styles.sideWrapper}>
          <div className={styles.sideTitle}>Menu</div>
          <nav className={styles.sideMenu}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`${styles.menuItem} ${item.active ? styles.active : ""}`}
                  onClick={item.onClick}
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <Link
              href="/trends"
              className={styles.menuItem}
              onClick={() => {
                closeChat();
                closeDrawers();
              }}
            >
              <TrendingUp />
              <span>Trend Radar</span>
              <span className={styles.menuItemMeta}>NEW</span>
            </Link>
          </nav>
        </div>

        <div className={styles.sidebarFooter}>
          <Link
            href="/about"
            className={styles.sidebarFooterCard}
            onClick={() => {
              closeChat();
              closeDrawers();
            }}
          >
            <span className={styles.sidebarFooterIcon}>
              <Sparkles />
            </span>
            <span>
              Learn the platform
              <em>Read the Social Assembly story</em>
            </span>
          </Link>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════
          Main column — search, profile header, timeline (chat swaps in
          when a session is open)
          ═══════════════════════════════════════════════════════════════ */}
      <main className={styles.main}>
        <div className={styles.searchBar}>
          <button
            type="button"
            className={styles.leftSideToggle}
            onClick={() => setLeftOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <Menu />
          </button>

          <div className={styles.searchInputWrap}>
            <Search />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search creators, sessions, trends…"
            />
          </div>

          {/* Mobile-only quick logout — always visible so the user never has
              to open the sessions drawer just to sign out. */}
          <button
            type="button"
            className={styles.topBarLogout}
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut />
          </button>

          <button
            type="button"
            className={styles.rightSideToggle}
            onClick={() => setRightOpen((v) => !v)}
            aria-label="Open sessions panel"
          >
            <PanelRight />
          </button>
        </div>

        {isChatOpen ? (
          <div className={styles.chatMount}>
            <SessionChat userName={user.name} userAvatar={user.avatar} />
          </div>
        ) : (
          <div className={styles.mainContainer}>
            {/* Profile header */}
            <section className={styles.profile}>
              <div className={styles.profileCover} aria-hidden="true" />

              <div className={styles.profileAvatar}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.profileImg}
                  src={user.avatar}
                  alt={user.name}
                />
                <div className={styles.profileMeta}>
                  <h1 className={styles.profileName}>{user.name}</h1>
                  <div className={styles.profileRole}>Creator · Founder</div>
                </div>
              </div>

              <nav className={styles.profileMenu} aria-label="Profile sections">
                {PROFILE_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.profileMenuLink} ${
                      profileTab === t.id ? styles.active : ""
                    }`}
                    onClick={() => setProfileTab(t.id)}
                    aria-current={profileTab === t.id ? "page" : undefined}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </section>

            {/* Tabbed body — Timeline (intro + session CTA), About
                (per-platform analytics), and coming-soon placeholders.
                The coach lives in the session chat surface now, opened
                from the left nav or the right-rail sessions list. */}
            {profileTab === "timeline" ? (
              <div className={styles.timelineSingle}>
                <div className={styles.timelinePair}>
                  <div className={styles.box}>
                    <div className={styles.boxHeader}>
                      <h2 className={styles.boxTitle}>Your profile</h2>
                      <span className={styles.boxLabel}>Creator</span>
                    </div>
                    <div className={styles.boxBody}>
                      <div className={styles.introItem}>
                        <Briefcase />
                        <span>
                          Founder at <strong>Social Assembly</strong>
                        </span>
                      </div>
                      <div className={styles.introItem}>
                        <MapPin />
                        <span>
                          Based in <strong>Johannesburg, SA</strong>
                        </span>
                      </div>
                      <div className={styles.introItem}>
                        <Mail />
                        <a href={`mailto:${user.email}`}>{user.email}</a>
                      </div>
                    </div>
                  </div>

                  <div className={`${styles.box} ${styles.session}`}>
                    <div className={styles.sessionEyebrow}>
                      <span className={styles.sessionDot} />
                      Next coaching session
                    </div>
                    <h3 className={styles.sessionTitle}>
                      Drop your next video for a hook review
                    </h3>
                    <p className={styles.sessionSubtitle}>
                      Start a new session and the Content Coach will score its
                      first three seconds, flag attention drops, and suggest
                      fixes before you publish.
                    </p>
                    <button
                      type="button"
                      className={styles.sessionCTA}
                      onClick={startNewSession}
                    >
                      Start new session
                    </button>
                  </div>
                </div>

                <div className={styles.timelinePair}>
                  <div className={`${styles.box} ${styles.session}`}>
                    <div className={styles.sessionEyebrow}>
                      <span className={styles.sessionDot} />
                      Full content pipeline
                    </div>
                    <h3 className={styles.sessionTitle}>
                      Generate a vetted content plan end-to-end
                    </h3>
                    <p className={styles.sessionSubtitle}>
                      Fires the 11-agent orchestrator (Profiler → Analyst →
                      Strategist → Researcher → Creator → 5-seat panel →
                      Learner). Watch every stage live in the right rail.
                      Takes ~5–15 min and burns API quota — heavier than a
                      coaching chat.
                    </p>
                    <RunPipelineButton
                      uploader={user.email}
                      onStarted={openPipelineRun}
                    />
                  </div>
                </div>
              </div>
            ) : profileTab === "about" ? (
              <AboutPanel user={user} />
            ) : profileTab === "events" ? (
              <EventsPanel onBeforeChat={closeDrawers} />
            ) : (
              <div className={styles.comingSoon}>
                <div className={styles.comingSoonGlyph}>
                  <Sparkles />
                </div>
                <h3 className={styles.comingSoonTitle}>
                  {PROFILE_TABS.find((t) => t.id === profileTab)?.label} — coming soon
                </h3>
                <p className={styles.comingSoonBody}>
                  This view is being wired up next. For now, jump back to{" "}
                  <strong>Timeline</strong> or hit{" "}
                  <strong>New Session</strong> to talk to the coach.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Artifact panel overlay (on top of main area) */}
        <div
          className={`${styles.artifactOverlay} ${artifactOpen ? styles.active : ""}`}
        >
          {artifact ? (
            <ArtifactPanel artifact={artifact} onClose={closeArtifact} />
          ) : null}
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          Right sidebar — account bar + sessions list
          ═══════════════════════════════════════════════════════════════ */}
      <aside
        className={`${styles.rightSide} ${rightOpen ? styles.active : ""}`}
        aria-label="Sessions"
      >
        <div className={styles.account}>
          <button
            type="button"
            className={`${styles.accountBtn} ${styles.hasNotification}`}
            aria-label="Messages"
          >
            <Mail />
          </button>
          <button
            type="button"
            className={`${styles.accountBtn} ${
              notifOpen ? styles.active : ""
            }`}
            aria-label={
              unreadCount > 0
                ? `Notifications (${unreadCount} unread)`
                : "Notifications"
            }
            aria-expanded={notifOpen}
            data-notif-trigger="true"
            onClick={() => setNotifOpen((v) => !v)}
          >
            <Bell />
            {unreadCount > 0 && (
              <span className={styles.notifBellCount} aria-hidden="true">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <NotificationsPanel
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            onOpenChatWith={(prompt) => {
              setNotifOpen(false);
              closeDrawers();
              void startSessionFromNotification(prompt);
            }}
            onMutate={refreshUnread}
          />
          <button type="button" className={styles.accountUser}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.accountProfile}
              src={user.avatar}
              alt={user.name}
            />
            <span className={styles.accountUserText}>
              <span className={styles.accountUserName}>{firstName}</span>
              <span className={styles.accountUserMeta}>You</span>
            </span>
          </button>
          <button
            type="button"
            className={styles.accountLogout}
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut />
          </button>
        </div>

        <div className={styles.rightWrapper}>
          {pipelineOpen ? (
            <PipelinePanel />
          ) : journeyOpen ? (
            <JourneyPanel />
          ) : exemplarOpen ? (
            <VideoPanel />
          ) : (
            <SessionsList userName={user.name} userAvatar={user.avatar} />
          )}
        </div>
      </aside>

      {/* Mobile drawer backdrop */}
      <div
        className={`${styles.overlay} ${leftOpen || rightOpen ? styles.active : ""}`}
        onClick={closeDrawers}
        aria-hidden="true"
      />
    </div>
  );
}

/* ─── RunPipelineButton — kicks off the orchestrator and opens the live panel.
       Tiny inline component so it can use usePipeline without bloating the
       parent's prop list. ─── */
function RunPipelineButton({
  uploader,
  onStarted,
}: {
  uploader: string;
  onStarted: (runId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    const input = window.prompt(
      "What would you like the pipeline to plan?",
      "Plan a TikTok hook + 30-second script about a creator's morning routine.",
    );
    if (!input) {
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "manual", input }),
      });
      const json = (await res.json()) as { run_id?: string; error?: string };
      if (!res.ok || !json.run_id) {
        throw new Error(json.error ?? `${res.status}`);
      }
      onStarted(json.run_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.sessionCTA}
        onClick={start}
        disabled={busy}
        title={`Will run as ${uploader}`}
      >
        {busy ? "Starting…" : "Run full pipeline"}
      </button>
      {error ? (
        <p style={{ color: "#e63946", fontSize: 12, marginTop: 8 }}>
          {error.includes("cooldown")
            ? "You ran a pipeline recently — wait a few minutes before kicking off another one."
            : error.includes("daily cap")
              ? "Daily pipeline cap reached — try again tomorrow."
              : `Could not start: ${error}`}
        </p>
      ) : null}
    </>
  );
}

/* ─── Root page — artifact + exemplar + journey + pipeline contexts wrap the provider stack ─── */
export default function DashboardPage() {
  return (
    <ArtifactProvider>
      <ExemplarProvider>
        <JourneyProvider>
          <PipelineProvider>
            <DashboardProviders />
          </PipelineProvider>
        </JourneyProvider>
      </ExemplarProvider>
    </ArtifactProvider>
  );
}
