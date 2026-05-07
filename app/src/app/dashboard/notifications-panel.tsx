"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TrendingUp,
  Sparkles,
  Clock,
  AlertTriangle,
  MapPin,
  X,
  RefreshCw,
  Bookmark,
  BookmarkCheck,
  Trash2,
  WifiOff,
  Activity,
} from "lucide-react";
import styles from "./dashboard.module.css";
import {
  CATEGORY_LABEL,
  Notification,
  NotificationCategory,
  formatRelativeTime,
  patchNotification,
} from "./notifications-data";
import { usePipeline } from "./pipeline-context";

/* Unified notifications panel. Fetches /api/notifications (the DB-backed
   feed populated by every writer in the system: Researcher trends,
   Strategist opportunities, Learner reminders, system platform updates).
   Each row supports mark-read, bookmark, and dismiss actions via PATCH
   /api/notifications/[id].

   Categories are rendered with their own icon + badge. Trend rows lift
   the platform / region / score extras out of `meta` for parity with the
   old trend-only feed; other categories render the generic shape only. */

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; rows: Notification[] }
  | { status: "error"; message: string };

const CATEGORY_ICON: Record<NotificationCategory, React.ReactNode> = {
  trend: <TrendingUp />,
  opportunity: <Sparkles />,
  reminder: <Clock />,
  platform_update: <AlertTriangle />,
};

async function fetchFeed(): Promise<Notification[]> {
  const res = await fetch("/api/notifications?limit=30", { cache: "no-store" });
  if (!res.ok) throw new Error(`Notifications API responded with ${res.status}`);
  const json = (await res.json()) as { notifications?: Notification[] };
  return json.notifications ?? [];
}

export default function NotificationsPanel({
  open,
  onClose,
  onOpenChatWith,
  onMutate,
}: {
  open: boolean;
  onClose: () => void;
  onOpenChatWith: (prompt: string) => void;
  /** Fires after any read / bookmark / dismiss so the parent can
   *  re-poll the bell-badge unread count without waiting for the
   *  60 s timer. */
  onMutate?: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");
  // Tracks which trend rows are mid-flight to /api/orchestrate so the
  // button can show its own loading state without stepping on others.
  const [pipelineBusyId, setPipelineBusyId] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const { openRun: openPipelineRun } = usePipeline();

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const rows = await fetchFeed();
      setState({ status: "ready", rows });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Couldn't load notifications",
      });
    }
  }, []);

  useEffect(() => {
    if (open && state.status === "idle") {
      void load();
    }
  }, [open, state.status, load]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Outside click closes (the bell button is whitelisted via data attr)
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!panelRef.current || !target) return;
      if (panelRef.current.contains(target)) return;
      const bell = document.querySelector('[data-notif-trigger="true"]');
      if (bell && bell.contains(target)) return;
      onClose();
    };
    const t = window.setTimeout(
      () => document.addEventListener("click", onClick),
      0,
    );
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", onClick);
    };
  }, [open, onClose]);

  // Mutate one row in local state — used for optimistic-ish updates so the
  // bookmark / dismiss UI feels instant while the PATCH is in flight.
  const updateLocal = useCallback(
    (id: string, patch: Partial<Notification>) => {
      setState((prev) =>
        prev.status === "ready"
          ? {
              status: "ready",
              rows: prev.rows
                .map((r) => (r.id === id ? { ...r, ...patch } : r))
                // Hide dismissed rows from the list immediately (server still
                // keeps them; user can un-dismiss via the API later).
                .filter((r) => !patch.dismissed_at || r.id !== id),
            }
          : prev,
      );
    },
    [],
  );

  if (!open) return null;

  const rows = state.status === "ready" ? state.rows : [];
  const visible =
    filter === "all" ? rows : rows.filter((r) => r.category === filter);
  const loading = state.status === "loading";
  const offline = state.status === "error";

  const handleOpen = (n: Notification) => {
    // Mark as read on click (don't await — the chat opens immediately).
    if (!n.read_at) {
      updateLocal(n.id, { read_at: new Date().toISOString() });
      void patchNotification(n.id, { read: true }).then(onMutate);
    }
    onOpenChatWith(n.chat_prompt ?? n.body);
  };

  const handleBookmark = async (n: Notification) => {
    const next = !n.bookmarked_at;
    updateLocal(n.id, {
      bookmarked_at: next ? new Date().toISOString() : null,
    });
    await patchNotification(n.id, { bookmarked: next });
    onMutate?.();
  };

  const handleDismiss = async (n: Notification) => {
    updateLocal(n.id, { dismissed_at: new Date().toISOString() });
    await patchNotification(n.id, { dismissed: true });
    onMutate?.();
  };

  // Phase 2 trigger: turn a trend notification into a full pipeline run.
  // Replaces the chat-only "Open in chat" path for users who want a
  // complete vetted draft instead of a coaching conversation.
  const handlePlanPipeline = async (n: Notification) => {
    setPipelineBusyId(n.id);
    setPipelineError(null);
    const meta = n.meta || {};
    const platform = typeof meta.platform === "string" ? meta.platform : "tiktok";
    const region = typeof meta.region === "string" ? meta.region : "";
    const howToJoin =
      typeof meta.how_to_join === "string" ? meta.how_to_join : "";
    const promptInput =
      `Plan a post that rides the trend "${n.title}". ` +
      `Platform: ${platform}. ` +
      (region ? `Region: ${region}. ` : "") +
      `Trend brief: ${n.body} ` +
      (howToJoin ? `Suggested angle: ${howToJoin}. ` : "") +
      `Optimise for short-form vertical video.`;
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent: "trend_plan",
          input: promptInput,
          seed: {
            notification_id: n.id,
            trend:           n.title,
            platform,
            region,
            score:           typeof meta.score === "number" ? meta.score : null,
          },
        }),
      });
      const json = (await res.json()) as { run_id?: string; error?: string };
      if (!res.ok || !json.run_id) {
        throw new Error(json.error ?? `${res.status}`);
      }
      // Mark notification as read on convert — replaces the bell-badge
      // count behaviour from the chat path.
      if (!n.read_at) {
        updateLocal(n.id, { read_at: new Date().toISOString() });
        void patchNotification(n.id, { read: true }).then(onMutate);
      }
      openPipelineRun(json.run_id);
      onClose(); // hide the bell popover so the right rail's pipeline panel is visible
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : String(e));
    } finally {
      setPipelineBusyId(null);
    }
  };

  return (
    <>
      <div
        className={styles.notifBackdrop}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={styles.notifPanel}
        role="dialog"
        aria-label="Notifications"
      >
        <header className={styles.notifHeader}>
          <div className={styles.notifHeaderLeft}>
            <span className={styles.notifHeaderIcon}>
              <Sparkles />
            </span>
            <div>
              <div className={styles.notifHeaderTitle}>Notifications</div>
              <div className={styles.notifHeaderSub}>
                {loading
                  ? "Loading…"
                  : `${rows.length} update${rows.length === 1 ? "" : "s"}`}
              </div>
            </div>
          </div>
          <div className={styles.notifHeaderActions}>
            <button
              type="button"
              className={styles.notifClose}
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw />
            </button>
            <button
              type="button"
              className={styles.notifClose}
              onClick={onClose}
              aria-label="Close notifications"
            >
              <X />
            </button>
          </div>
        </header>

        {/* Category filter chips */}
        <div className={styles.notifFilterRow} role="tablist" aria-label="Filter by category">
          {(["all", "trend", "opportunity", "reminder", "platform_update"] as const).map(
            (cat) => {
              const active = filter === cat;
              const label =
                cat === "all" ? "All" : CATEGORY_LABEL[cat as NotificationCategory];
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(cat)}
                  className={`${styles.notifFilterChip} ${active ? styles.notifFilterChipActive : ""}`}
                >
                  {label}
                </button>
              );
            },
          )}
        </div>

        {offline ? (
          <div className={styles.notifOffline} role="status">
            <WifiOff />
            <div>
              <strong>Couldn&rsquo;t load notifications.</strong>
              <span>{(state as { message: string }).message}</span>
            </div>
          </div>
        ) : null}

        {pipelineError ? (
          <div className={styles.notifOffline} role="status">
            <AlertTriangle />
            <div>
              <strong>Couldn&rsquo;t start pipeline.</strong>
              <span>
                {pipelineError.includes("cooldown")
                  ? "Wait a few minutes between pipeline runs."
                  : pipelineError.includes("daily cap")
                    ? "Daily pipeline cap reached."
                    : pipelineError}
              </span>
            </div>
          </div>
        ) : null}

        {loading ? (
          <ul className={styles.notifList} aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className={styles.notifItemSkeleton}>
                <div className={styles.notifSkelLine} style={{ width: "40%" }} />
                <div
                  className={styles.notifSkelLine}
                  style={{ width: "70%", height: 16 }}
                />
                <div className={styles.notifSkelLine} style={{ width: "55%" }} />
                <div className={styles.notifSkelBlock} />
              </li>
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <div className={styles.notifEmpty}>
            {filter === "all"
              ? "No notifications yet — agents will populate this as they run."
              : `No ${CATEGORY_LABEL[filter as NotificationCategory]} notifications.`}
          </div>
        ) : (
          <ul className={styles.notifList}>
            {visible.map((n) => {
              const isUnread = !n.read_at;
              const isBookmarked = !!n.bookmarked_at;
              const meta = n.meta || {};
              const platform =
                typeof meta.platform === "string" ? meta.platform : null;
              const region =
                typeof meta.region === "string" ? meta.region : null;
              const score =
                typeof meta.score === "number" ? meta.score : null;
              return (
                <li
                  key={n.id}
                  className={`${styles.notifItem} ${isUnread ? styles.notifItemUnread : ""}`}
                >
                  <div className={styles.notifItemMeta}>
                    <span
                      className={`${styles.notifItemBadge} ${styles[`notifBadge_${n.category}`] ?? ""}`}
                    >
                      {CATEGORY_ICON[n.category]}
                      {CATEGORY_LABEL[n.category]}
                    </span>
                    <span className={styles.notifItemDot} aria-hidden="true">
                      ·
                    </span>
                    <span className={styles.notifItemTime}>
                      <Clock />
                      {formatRelativeTime(n.created_at)}
                    </span>
                    {typeof score === "number" ? (
                      <span
                        className={styles.notifItemScore}
                        title="Viral potential score"
                      >
                        {score}
                      </span>
                    ) : null}
                    <div className={styles.notifItemActions}>
                      <button
                        type="button"
                        className={styles.notifItemActionBtn}
                        onClick={() => void handleBookmark(n)}
                        aria-pressed={isBookmarked}
                        title={isBookmarked ? "Remove bookmark" : "Save"}
                        aria-label={isBookmarked ? "Remove bookmark" : "Save"}
                      >
                        {isBookmarked ? <BookmarkCheck /> : <Bookmark />}
                      </button>
                      <button
                        type="button"
                        className={styles.notifItemActionBtn}
                        onClick={() => void handleDismiss(n)}
                        title="Dismiss"
                        aria-label="Dismiss"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>

                  <h3 className={styles.notifItemTitle}>{n.title}</h3>

                  {(platform || region) && (
                    <div className={styles.notifItemWhere}>
                      <MapPin />
                      <span>
                        {platform ? <strong>{platform}</strong> : null}
                        {platform && region ? " · " : ""}
                        {region}
                      </span>
                    </div>
                  )}

                  <p className={styles.notifItemAbout}>{n.body}</p>

                  {typeof meta.how_to_join === "string" && meta.how_to_join ? (
                    <div className={styles.notifItemJoin}>
                      <span className={styles.notifItemJoinLabel}>How to join</span>
                      <p>{meta.how_to_join as string}</p>
                    </div>
                  ) : null}

                  <div className={styles.notifItemCTARow}>
                    {n.chat_prompt ? (
                      <button
                        type="button"
                        className={styles.notifItemCTA}
                        onClick={() => handleOpen(n)}
                      >
                        Open in chat
                      </button>
                    ) : null}
                    {n.category === "trend" ? (
                      <button
                        type="button"
                        className={styles.notifItemCTASecondary}
                        disabled={pipelineBusyId === n.id}
                        onClick={() => void handlePlanPipeline(n)}
                        title="Run the orchestrator pipeline to produce a full vetted draft"
                      >
                        <Activity />
                        <span>
                          {pipelineBusyId === n.id ? "Starting…" : "Plan a post"}
                        </span>
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
