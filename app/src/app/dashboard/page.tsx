"use client";

// Mazra'at albaan — dashboard.
//
// Layout reuses the lifted Social Assembly dashboard shell (left sidebar /
// profile header / right rail) so visual styling stays consistent. The panel
// modules from the original (session chat, journey, exemplar, pipeline,
// artifact, video) were Social-Assembly-specific and have been removed.
// Right rail is now a simple inline alerts list — drought triggers,
// repayment reminders, supplier updates.
//
// Auth: when Supabase env vars are missing we render a stub user; once
// configured the real auth flow takes over.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Home,
  Sprout,
  ShieldCheck,
  ShoppingBag,
  HelpCircle,
  Bell,
  Mail,
  Search,
  Menu,
  PanelRight,
  Briefcase,
  MapPin,
  Sparkles,
  LogOut,
  Droplets,
  CalendarDays,
  Wallet,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { WalletButton } from "@/lib/vuna/wallet-button";
import {
  fetchGrowPack,
  getConnection,
  farmerIdHashFrom,
  farmerPda,
  packPda,
  type GrowPack,
} from "@/lib/vuna/program";
import { ApplyTab } from "./apply-tab";
import { ListenButton } from "@/lib/vuna/listen-button";
import styles from "./dashboard.module.css";

type ProfileTab =
  | "active"
  | "apply"
  | "insurance"
  | "history"
  | "about"
  | "marketplace";

// Tabs surfaced in the profile-header menu. "marketplace" is reachable
// only via the sidebar nav, so it's intentionally absent here.
const PROFILE_TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: "active", label: "Active" },
  { id: "apply", label: "Apply" },
  { id: "insurance", label: "Insurance" },
  { id: "history", label: "History" },
  { id: "about", label: "About" },
];

// localStorage key for the IDs of alerts the user has dismissed via
// the bell. Persisted across reloads so the unread badge stays cleared.
const DISMISSED_ALERTS_KEY = "vuna.dismissedAlerts";

/** The demo Grow Pack we created via scripts/setup-devnet-demo.mjs. */
const DEMO_PACK_ADDRESS = "AShtE5mNczJqoLYSQzASMHb5vLiAb3RSavPoLW4NyzAd";

type DashUser = { name: string; email: string };

// ─── Hardcoded demo data — replace with real on-chain reads once a known
//     pack PDA is deployed and the wallet adapter is wired. ───────────────
const ACTIVE_PACK = {
  crop: "Maize",
  hectares: 2.0,
  region: "Eastern Cape",
  dayOfSeason: 60,
  totalDays: 120,
  bundle: "R 1,655",
  repayAtHarvest: "R 1,820",
  weather: { tempC: 22, conditions: "Light rain expected Thu", monthMm: 47, status: "normal" as const },
  credit: { score: 720, label: "Good standing", trend: "+40 since last season" },
  checklist: [
    { label: "Seeds delivered", done: true },
    { label: "Fertilizer delivered", done: true },
    { label: "Drought cover active", done: true },
    { label: "Harvest scheduled", done: false },
  ],
};

const ALERTS = [
  {
    id: "drought-eastern-cape",
    severity: "warn" as const,
    title: "Rainfall watch — Eastern Cape",
    body: "32 mm of expected 80 mm so far this month. Cover threshold not yet breached.",
    when: "today",
  },
  {
    id: "repayment-due",
    severity: "info" as const,
    title: "Repayment in 14 days",
    body: "Estimated R 1,820 due at harvest sale. No action needed yet.",
    when: "yesterday",
  },
  {
    id: "supplier",
    severity: "info" as const,
    title: "Supplier confirmed delivery",
    body: "100 kg NPK fertilizer signed for at the cooperative depot.",
    when: "Mon",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<DashUser | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("active");
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(
    new Set(),
  );
  const { publicKey: walletPubkey } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  // Hydrate dismissed-alert IDs from localStorage on mount. Keep it in
  // an effect (not lazy useState init) so SSR and the first client
  // render agree — preventing hydration mismatches.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DISMISSED_ALERTS_KEY);
      if (!raw) return;
      const ids: unknown = JSON.parse(raw);
      if (Array.isArray(ids)) {
        setDismissedAlertIds(new Set(ids.filter((x): x is string => typeof x === "string")));
      }
    } catch {
      /* corrupt entry — ignore and let the user re-dismiss */
    }
  }, []);

  const dismissAllAlerts = () => {
    const allIds = ALERTS.map((a) => a.id);
    setDismissedAlertIds(new Set(allIds));
    try {
      window.localStorage.setItem(
        DISMISSED_ALERTS_KEY,
        JSON.stringify(allIds),
      );
    } catch {
      /* private mode / quota — UI state still updates for this session */
    }
  };

  // Supabase user load (or stub in demo mode)
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setUser({ name: "Demo Farmer", email: "demo@mazraat.local" });
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let mounted = true;

    const userFrom = (
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
      const fallback = email.split("@")[0]?.replace(/[._-]+/g, " ") || email;
      return { name: fullName || fallback, email };
    };

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const next = userFrom(data.user);
      if (!next) {
        router.replace("/login");
        return;
      }
      setUser(next);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        const next = userFrom(session?.user ?? null);
        if (!next) router.replace("/login");
        else setUser(next);
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
      } catch {
        /* offline — fall through to redirect */
      }
    }
    router.push("/");
  };

  if (!user) return null;
  const firstName = user.name.split(" ")[0] ?? user.name;
  const initials = (firstName[0] ?? "F").toUpperCase();

  const closeDrawers = () => {
    setLeftOpen(false);
    setRightOpen(false);
  };

  const goToTab = (tab: ProfileTab) => {
    setProfileTab(tab);
    closeDrawers();
  };

  const walletShort = walletPubkey
    ? `${walletPubkey.toBase58().slice(0, 4)}…${walletPubkey.toBase58().slice(-4)}`
    : null;

  const navItems = [
    {
      icon: Home,
      label: "Home",
      active: profileTab === "active",
      onClick: () => goToTab("active"),
    },
    {
      icon: Sprout,
      label: "Apply for Pack",
      active: profileTab === "apply",
      onClick: () => goToTab("apply"),
    },
    {
      icon: ShieldCheck,
      label: "Insurance",
      active: profileTab === "insurance",
      onClick: () => goToTab("insurance"),
    },
    {
      icon: Wallet,
      label: "Wallet",
      meta: walletShort ?? undefined,
      onClick: () => {
        if (!walletPubkey) setWalletModalVisible(true);
        // If connected, the meta badge already shows the address — clicking
        // again is a no-op (use the right-rail button to disconnect).
      },
    },
    {
      icon: ShoppingBag,
      label: "Marketplace",
      meta: "soon",
      active: profileTab === "marketplace",
      onClick: () => goToTab("marketplace"),
    },
  ];

  const unreadCount = ALERTS.filter((a) => !dismissedAlertIds.has(a.id)).length;

  return (
    <div className={styles.container}>
      {/* ═══ Left sidebar ═══ */}
      <aside
        className={`${styles.leftSide} ${leftOpen ? styles.active : ""}`}
        aria-label="Primary navigation"
      >
        <button
          type="button"
          className={styles.logo}
          onClick={() => goToTab("active")}
          aria-label="Mazra'at albaan — go to home"
        >
          <div className={styles.logoMark}>MA</div>
          <div className={styles.logoText}>
            Mazra&apos;at albaan
            <em>Farmer Studio</em>
          </div>
        </button>

        <div className={styles.sideWrapper}>
          <div className={styles.sideTitle}>Menu</div>
          <nav className={styles.sideMenu}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const meta = "meta" in item ? item.meta : undefined;
              const Meta = meta ? (
                <span className={styles.menuItemMeta}>{meta}</span>
              ) : null;
              if ("href" in item && item.href) {
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={styles.menuItem}
                    onClick={closeDrawers}
                  >
                    <Icon />
                    <span>{item.label}</span>
                    {Meta}
                  </Link>
                );
              }
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`${styles.menuItem} ${
                    "active" in item && item.active ? styles.active : ""
                  }`}
                  onClick={item.onClick}
                >
                  <Icon />
                  <span>{item.label}</span>
                  {Meta}
                </button>
              );
            })}
          </nav>
        </div>

        <div className={styles.sidebarFooter}>
          <Link
            href="/"
            className={styles.sidebarFooterCard}
            onClick={closeDrawers}
          >
            <span className={styles.sidebarFooterIcon}>
              <HelpCircle />
            </span>
            <span>
              About the platform
              <em>Read what Mazra&apos;at albaan does</em>
            </span>
          </Link>
        </div>
      </aside>

      {/* ═══ Main column ═══ */}
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
              placeholder="Search — coming soon"
              disabled
              aria-disabled="true"
              title="Search will be enabled once the marketplace + history tabs are wired up"
              style={{ opacity: 0.55, cursor: "not-allowed" }}
            />
          </div>

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
            aria-label="Open alerts panel"
          >
            <PanelRight />
          </button>
        </div>

        <div className={styles.mainContainer}>
          {/* Profile header */}
          <section className={styles.profile}>
            <div className={styles.profileCover} aria-hidden="true" />

            <div className={styles.profileAvatar}>
              <div
                className={styles.profileImg}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                  color: "#1a0f0c",
                  fontWeight: 800,
                  fontSize: 18,
                  letterSpacing: "0.04em",
                }}
                aria-label={user.name}
              >
                {initials}
              </div>
              <div className={styles.profileMeta}>
                <h1 className={styles.profileName}>{user.name}</h1>
                <div className={styles.profileRole}>
                  Smallholder · {ACTIVE_PACK.region}
                </div>
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

          {/* Tabbed body */}
          {profileTab === "active" ? (
            <ActiveTab firstName={firstName} onApplyClick={() => goToTab("apply")} />
          ) : profileTab === "apply" ? (
            <ApplyTab onNavigateToInsurance={() => goToTab("insurance")} />
          ) : profileTab === "insurance" ? (
            <InsuranceTab />
          ) : profileTab === "about" ? (
            <AboutTab user={user} />
          ) : profileTab === "marketplace" ? (
            <ComingSoon label="Marketplace" />
          ) : (
            <HistoryTab onViewPack={() => goToTab("insurance")} />
          )}
        </div>
      </main>

      {/* ═══ Right sidebar — alerts ═══ */}
      <aside
        className={`${styles.rightSide} ${rightOpen ? styles.active : ""}`}
        aria-label="Alerts"
      >
        <div className={styles.account}>
          {/* Wallet connect — replaces the placeholder mail icon */}
          <WalletButton className={styles.accountBtn} />

          {/* Bell — clicking marks all alerts as read (clears the badge).
              The alerts themselves stay visible in the rail below; this
              is just a "I've seen these" acknowledgement. Dismissed
              state persists via localStorage. */}
          <button
            type="button"
            className={styles.accountBtn}
            aria-label={
              unreadCount > 0
                ? `Mark ${unreadCount} alert${unreadCount === 1 ? "" : "s"} as read`
                : "All alerts read"
            }
            title={
              unreadCount > 0
                ? `${unreadCount} unread — click to mark as read`
                : "All caught up"
            }
            onClick={() => {
              if (unreadCount > 0) dismissAllAlerts();
            }}
            disabled={unreadCount === 0}
            style={{
              position: "relative",
              opacity: unreadCount === 0 ? 0.55 : 1,
              cursor: unreadCount === 0 ? "default" : "pointer",
            }}
          >
            <Bell />
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -5,
                  right: -5,
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 9,
                  background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                  color: "#1a0f0c",
                  fontSize: 10,
                  fontWeight: 800,
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 4px 10px rgba(255, 123, 107, 0.45)",
                  border: "2px solid #160b08",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Spacer */}
          <div style={{ flex: 1, minWidth: 0 }} />

          {/* User pill — avatar + name */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              minWidth: 0,
              padding: "4px 10px 4px 4px",
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 230, 210, 0.08)",
            }}
            title={user.name}
          >
            <div
              aria-label={user.name}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                color: "#1a0f0c",
                fontSize: 11,
                fontWeight: 800,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                boxShadow: "0 4px 12px rgba(255, 123, 107, 0.3)",
                letterSpacing: "0.04em",
              }}
            >
              {initials}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                lineHeight: 1.15,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "rgba(255, 245, 230, 0.95)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 96,
                }}
              >
                {firstName}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(255, 230, 210, 0.45)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  marginTop: 1,
                }}
              >
                You
              </span>
            </div>
          </div>

          {/* Logout */}
          <button
            type="button"
            className={styles.accountBtn}
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut />
          </button>
        </div>

        <div className={styles.rightWrapper}>
          <AlertsList dismissedIds={dismissedAlertIds} />
        </div>
      </aside>

      {/* Mobile backdrop */}
      <div
        className={`${styles.overlay} ${
          leftOpen || rightOpen ? styles.active : ""
        }`}
        onClick={closeDrawers}
        aria-hidden="true"
      />
    </div>
  );
}

// ============================================================================
//  Tabs
// ============================================================================

function ActiveTab({
  firstName,
  onApplyClick,
}: {
  firstName: string;
  onApplyClick: () => void;
}) {
  const pct = Math.round(
    (ACTIVE_PACK.dayOfSeason / ACTIVE_PACK.totalDays) * 100,
  );
  const greetingLine = `Hello ${firstName}. You are on day ${ACTIVE_PACK.dayOfSeason} of ${ACTIVE_PACK.totalDays} of your ${ACTIVE_PACK.crop.toLowerCase()} season — that is ${pct} percent of the way through. Rainfall this month is ${ACTIVE_PACK.weather.monthMm} millimetres, which is normal. Repayment of about ${ACTIVE_PACK.repayAtHarvest.replace("R ", "")} Rand is due at harvest.`;

  return (
    <div className={styles.timelineSingle}>
      <div className={styles.timelinePair}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>Sawubona, {firstName}</h2>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <ListenButton
                size="sm"
                text={greetingLine}
                ariaLabel="Listen — your daily summary, read aloud"
              />
              <span className={styles.boxLabel}>Active</span>
            </div>
          </div>
          <div className={styles.boxBody}>
            <div className={styles.introItem}>
              <Sprout />
              <span>
                Crop: <strong>{ACTIVE_PACK.crop}</strong> · {ACTIVE_PACK.hectares}{" "}
                ha
              </span>
            </div>
            <div className={styles.introItem}>
              <CalendarDays />
              <span>
                Day <strong>{ACTIVE_PACK.dayOfSeason}</strong> of{" "}
                {ACTIVE_PACK.totalDays} ({pct}%)
              </span>
            </div>
            <div className={styles.introItem}>
              <MapPin />
              <span>{ACTIVE_PACK.region}</span>
            </div>
          </div>
        </div>

        <div className={`${styles.box} ${styles.session}`}>
          <div className={styles.sessionEyebrow}>
            <span className={styles.sessionDot} />
            Active Grow Pack
          </div>
          <h3 className={styles.sessionTitle}>
            {ACTIVE_PACK.crop} · {ACTIVE_PACK.hectares} ha
          </h3>
          <p className={styles.sessionSubtitle}>
            Total today {ACTIVE_PACK.bundle} · Repay at harvest{" "}
            {ACTIVE_PACK.repayAtHarvest}
          </p>
          <ul style={{ marginTop: 16, listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
            {ACTIVE_PACK.checklist.map((item) => (
              <li
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  opacity: item.done ? 1 : 0.55,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: item.done ? "#E8B931" : "rgba(255,255,255,0.25)",
                  }}
                />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.timelinePair}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>Weather · 7 days</h2>
            <span className={styles.boxLabel}>
              {ACTIVE_PACK.weather.status === "normal" ? "Normal" : "Watch"}
            </span>
          </div>
          <div className={styles.boxBody}>
            <div className={styles.introItem}>
              <Droplets />
              <span>
                {ACTIVE_PACK.weather.tempC}°C ·{" "}
                {ACTIVE_PACK.weather.conditions}
              </span>
            </div>
            <div className={styles.introItem}>
              <span aria-hidden="true" style={{ width: 18 }} />
              <span>
                Rainfall this month:{" "}
                <strong>{ACTIVE_PACK.weather.monthMm} mm</strong> (normal)
              </span>
            </div>
          </div>
        </div>

        <div className={`${styles.box} ${styles.session}`}>
          <div className={styles.sessionEyebrow}>
            <span className={styles.sessionDot} />
            Your credit history
          </div>
          <h3 className={styles.sessionTitle}>
            {ACTIVE_PACK.credit.score}
          </h3>
          <p className={styles.sessionSubtitle}>
            {ACTIVE_PACK.credit.label} · {ACTIVE_PACK.credit.trend}
          </p>
          <button
            type="button"
            onClick={onApplyClick}
            className={styles.sessionCTA}
            style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            Plan next season
          </button>
        </div>
      </div>
    </div>
  );
}

function InsuranceTab() {
  const { publicKey: walletPubkey } = useWallet();
  const [pack, setPack] = useState<GrowPack | null>(null);
  const [packAddress, setPackAddress] = useState<string>(DEMO_PACK_ADDRESS);
  const [isPreview, setIsPreview] = useState<boolean>(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    (async () => {
      try {
        const conn = getConnection();
        let pubkey: PublicKey;
        let preview = false;

        if (walletPubkey) {
          // Wallet connected → derive *this farmer's* pack PDA for the
          // current season. Same derivation as the Apply tab uses.
          const farmerIdHash = await farmerIdHashFrom(walletPubkey.toBase58());
          const [farmerAcc] = farmerPda(walletPubkey, farmerIdHash);
          const seasonId = new Date().getFullYear();
          [pubkey] = packPda(farmerAcc, seasonId);
        } else {
          // No wallet → fall back to the hardcoded demo pack so the
          // screen has something to show for unconnected viewers.
          pubkey = new PublicKey(DEMO_PACK_ADDRESS);
          preview = true;
        }

        if (cancelled) return;
        setPackAddress(pubkey.toBase58());
        setIsPreview(preview);

        const data = await fetchGrowPack(conn, pubkey);
        if (cancelled) return;
        if (!data) {
          setLoadState("missing");
        } else {
          setPack(data);
          setLoadState("ready");
        }
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletPubkey]);

  if (loadState === "loading") {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.box}>
          <div className={styles.boxBody} style={{ textAlign: "center", padding: 28 }}>
            <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.55)" }}>
              Reading pack from devnet…
            </span>
          </div>
        </div>
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>Couldn&apos;t reach the chain</h2>
          </div>
          <div className={styles.boxBody}>
            <span style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.55)" }}>
              {errorMsg}
            </span>
          </div>
        </div>
      </div>
    );
  }
  if (loadState === "missing" || !pack) {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>No active drought protection</h2>
          </div>
          <div className={styles.boxBody}>
            <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.72)" }}>
              {walletPubkey
                ? "You don't have an active Grow Pack for this season yet. Open the Apply tab to request one — the drought policy goes live the moment your inputs are delivered."
                : "Connect your wallet to see your drought protection. Without one, this view falls back to a sample pack."}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const triggered = pack.status === "InsurancePaid" || pack.insurancePayout > 0n;
  const rainfall = pack.rainfallPercentOfNorm;
  const observedMm = Math.round((rainfall / 100) * 80);
  const payoutZAR = Number(pack.insurancePayout);
  const voiceLine = triggered
    ? `Hello. Rainfall has been low in your area — about ${rainfall} percent of normal. Your drought cover has paid you ${payoutZAR.toLocaleString("en-ZA")} Rand today. The money is on its way to your account. There is no paperwork to fill in, and no claim form to send.`
    : `Rainfall in your area is ${rainfall} percent of normal. The threshold has not been crossed, so no payout is due yet. Your drought cover is still active.`;

  return (
    <div className={styles.timelineSingle}>
      {isPreview ? (
        <div
          className={styles.box}
          style={{
            background: "rgba(255, 184, 107, 0.06)",
            border: "1px solid rgba(255, 184, 107, 0.25)",
          }}
        >
          <div className={styles.boxBody} style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.72)" }}>
            <strong style={{ color: "#ffb86b" }}>Sample pack</strong> — connect your wallet to see your own Grow Pack here.
          </div>
        </div>
      ) : null}

      {/* Big payout banner */}
      <div
        className={`${styles.box} ${styles.session}`}
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 184, 107, 0.18), rgba(255, 123, 107, 0.10))",
          border: "1px solid rgba(255, 184, 107, 0.45)",
          boxShadow: "0 14px 32px rgba(255, 123, 107, 0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div className={styles.sessionEyebrow}>
            <span className={styles.sessionDot} />
            {triggered ? "Payout sent" : "No payout due"}
          </div>
          <ListenButton
            text={voiceLine}
            ariaLabel={
              triggered
                ? "Listen — your drought payout, read aloud"
                : "Listen — current rainfall status, read aloud"
            }
          />
        </div>
        <h3
          className={styles.sessionTitle}
          style={{
            background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            color: "transparent",
            fontSize: 44,
            lineHeight: 1.05,
            marginTop: 6,
          }}
        >
          {formatRand(pack.insurancePayout)}
        </h3>
        <p className={styles.sessionSubtitle} style={{ marginTop: 8 }}>
          {triggered
            ? "Sent to your account. No paperwork. No claim form."
            : "Threshold not breached. Cover remains active."}
        </p>
      </div>

      <div className={styles.timelinePair}>
        {/* Why you were paid */}
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>
              {triggered ? "Why you were paid" : "Rainfall observation"}
            </h2>
            <span className={styles.boxLabel}>{rainfall}%</span>
          </div>
          <div className={styles.boxBody}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.72)" }}>
                Rainfall in your area
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: "rgba(255, 245, 230, 0.95)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {rainfall}%
              </span>
              <span style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.55)" }}>
                of 100% norm (≈ {observedMm}mm of 80mm)
              </span>
            </div>
            <RainfallBars
              rainfallPercent={rainfall}
              thresholdPercent={pack.thresholdPercent}
            />
          </div>
        </div>

        {/* Pack details */}
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>Pack details</h2>
            <span className={styles.boxLabel}>{pack.status}</span>
          </div>
          <div className={styles.boxBody}>
            <DetailRow label="Bundle cost" value={formatRand(pack.bundleCost)} />
            <DetailRow label="Service fee" value={formatRand(pack.serviceFee)} />
            <DetailRow label="Total repayment" value={formatRand(pack.totalRepayment)} />
            <DetailRow label="Threshold" value={`${pack.thresholdPercent}% of norm`} />
            <DetailRow label="Max payout" value={formatRand(pack.maxPayout)} />
            <DetailRow label="Insurance payout" value={formatRand(pack.insurancePayout)} highlight />
            <DetailRow label="Pack" value={shortPackId(packAddress)} mono />
          </div>
        </div>
      </div>

      {/* Reassurance */}
      <div
        className={styles.box}
        style={{
          background: "rgba(46, 125, 50, 0.10)",
          border: "1px solid rgba(46, 125, 50, 0.35)",
        }}
      >
        <div className={styles.boxBody}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255, 245, 230, 0.95)" }}>
            Your Grow Pack is still active.
          </div>
          <div style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.72)", marginTop: 4 }}>
            Talk to your co-op about replanting options.
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid rgba(255, 230, 210, 0.06)",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.55)" }}>{label}</span>
      <span
        style={{
          fontSize: highlight ? 14 : 13,
          fontWeight: highlight ? 800 : 600,
          color: highlight ? "#ffb86b" : "rgba(255, 245, 230, 0.92)",
          fontVariantNumeric: "tabular-nums",
          fontFamily: mono ? "var(--font-geist-mono), ui-monospace, monospace" : "inherit",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function RainfallBars({
  rainfallPercent,
  thresholdPercent,
}: {
  rainfallPercent: number;
  thresholdPercent: number;
}) {
  // Six even-weight buckets, smoothed across the season — same approach as
  // the standalone /insurance/[packId] page. Replace with real per-week
  // oracle data once we have it.
  const weeks = 6;
  const barFraction = rainfallPercent / weeks;
  const max = 30;
  const thresholdY = thresholdPercent / weeks;
  return (
    <div
      style={{
        position: "relative",
        height: 92,
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        padding: "0 28px 0 4px",
        marginTop: 6,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 4,
          right: 28,
          bottom: `${(thresholdY / max) * 100}%`,
          borderTop: "2px dashed #C0392B",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 0,
          bottom: `${(thresholdY / max) * 100}%`,
          transform: "translateY(-50%)",
          fontSize: 9,
          fontWeight: 800,
          color: "#C0392B",
          letterSpacing: "0.06em",
        }}
      >
        min
      </span>
      {Array.from({ length: weeks }).map((_, i) => {
        const heightPct = Math.min(100, (barFraction / max) * 100);
        const belowThreshold = barFraction < thresholdY;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
            <div
              style={{
                width: "100%",
                marginTop: "auto",
                height: `${heightPct}%`,
                borderRadius: 3,
                background: belowThreshold ? "#E67E22" : "#2E7D32",
                boxShadow: belowThreshold ? "0 0 12px rgba(230, 126, 34, 0.35)" : "none",
              }}
            />
            <div style={{ fontSize: 9, color: "rgba(255, 230, 210, 0.4)", marginTop: 4 }}>
              W{i + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ZAR_FORMATTER = new Intl.NumberFormat("en-ZA", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});
function formatRand(amount: bigint | number): string {
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  return `R ${ZAR_FORMATTER.format(n)}`;
}
function shortPackId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

// ============================================================================
//  History tab — past + current Grow Packs for the connected farmer
// ============================================================================

const HISTORY_SEASONS_LOOKBACK = 3; // current year + 2 prior

type HistoryRow = {
  season: number;
  address: string;
  pack: GrowPack;
};

function HistoryTab({ onViewPack }: { onViewPack: () => void }) {
  const { publicKey: walletPubkey } = useWallet();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "no-wallet" | "empty" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!walletPubkey) {
      setState("no-wallet");
      setRows([]);
      return;
    }

    let cancelled = false;
    setState("loading");

    (async () => {
      try {
        const conn = getConnection();
        const farmerIdHash = await farmerIdHashFrom(walletPubkey.toBase58());
        const [farmerAcc] = farmerPda(walletPubkey, farmerIdHash);

        const currentYear = new Date().getFullYear();
        const seasons = Array.from(
          { length: HISTORY_SEASONS_LOOKBACK },
          (_, i) => currentYear - i,
        );

        // Fetch every season in parallel — devnet RPC handles this fine
        // for a small number of accounts and the pack PDAs we don't have
        // simply come back as nulls.
        const fetched = await Promise.all(
          seasons.map(async (season) => {
            const [packAcc] = packPda(farmerAcc, season);
            const data = await fetchGrowPack(conn, packAcc);
            return { season, address: packAcc.toBase58(), data };
          }),
        );

        if (cancelled) return;

        const existing: HistoryRow[] = fetched
          .filter(
            (r): r is { season: number; address: string; data: GrowPack } =>
              r.data !== null,
          )
          .map(({ season, address, data }) => ({ season, address, pack: data }));

        setRows(existing);
        setState(existing.length > 0 ? "ready" : "empty");
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [walletPubkey]);

  if (state === "no-wallet") {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>History</h2>
          </div>
          <div className={styles.boxBody}>
            <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.72)" }}>
              Connect your wallet to see Grow Packs from past seasons.
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.box}>
          <div className={styles.boxBody} style={{ textAlign: "center", padding: 28 }}>
            <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.55)" }}>
              Reading your Grow Pack history from devnet…
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>Couldn&apos;t reach the chain</h2>
          </div>
          <div className={styles.boxBody}>
            <span style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.55)" }}>
              {errorMsg}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>No Grow Packs yet</h2>
          </div>
          <div className={styles.boxBody}>
            <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.72)" }}>
              You haven&apos;t requested a Grow Pack from this wallet in the last{" "}
              {HISTORY_SEASONS_LOOKBACK} seasons. Open the Apply tab to get started.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.timelineSingle}>
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => (
          <HistoryCard key={row.address} row={row} onView={onViewPack} />
        ))}
      </div>
    </div>
  );
}

function HistoryCard({ row, onView }: { row: HistoryRow; onView: () => void }) {
  const { season, address, pack } = row;
  const currentYear = new Date().getFullYear();
  const isCurrent = season === currentYear;

  return (
    <div className={styles.box}>
      <div className={styles.boxHeader}>
        <h2 className={styles.boxTitle}>Season {season}</h2>
        <span className={styles.boxLabel}>
          {isCurrent ? "Current" : "Past"}
        </span>
      </div>
      <div className={styles.boxBody}>
        <DetailRow label="Status" value={pack.status} highlight />
        <DetailRow label="Bundle cost" value={formatRand(pack.bundleCost)} />
        <DetailRow label="Total repayment" value={formatRand(pack.totalRepayment)} />
        <DetailRow
          label="Insurance payout"
          value={formatRand(pack.insurancePayout)}
        />
        <DetailRow label="Pack" value={shortPackId(address)} mono />
        {isCurrent ? (
          <button
            type="button"
            onClick={onView}
            style={{
              marginTop: 12,
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255, 184, 107, 0.5)",
              background: "rgba(255, 184, 107, 0.12)",
              color: "#ffb86b",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            View on Insurance tab →
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AboutTab({ user }: { user: DashUser }) {
  return (
    <div className={styles.timelineSingle}>
      <div className={styles.box}>
        <div className={styles.boxHeader}>
          <h2 className={styles.boxTitle}>Profile</h2>
          <span className={styles.boxLabel}>Farmer</span>
        </div>
        <div className={styles.boxBody}>
          <div className={styles.introItem}>
            <Briefcase />
            <span>
              Smallholder at <strong>{ACTIVE_PACK.region} Cooperative</strong>
            </span>
          </div>
          <div className={styles.introItem}>
            <MapPin />
            <span>
              Based in <strong>{ACTIVE_PACK.region}, SA</strong>
            </span>
          </div>
          <div className={styles.introItem}>
            <Mail />
            <a href={`mailto:${user.email}`}>{user.email}</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className={styles.comingSoon}>
      <div className={styles.comingSoonGlyph}>
        <Sparkles />
      </div>
      <h3 className={styles.comingSoonTitle}>
        {label} — coming soon
      </h3>
      <p className={styles.comingSoonBody}>
        This view is being wired up. For now, jump back to{" "}
        <strong>Active</strong> or open <strong>Insurance</strong> from the
        sidebar.
      </p>
    </div>
  );
}

// ============================================================================
//  Right rail — alerts
// ============================================================================

function AlertsList({ dismissedIds }: { dismissedIds: Set<string> }) {
  const allRead = ALERTS.every((a) => dismissedIds.has(a.id));

  return (
    <div style={{ padding: "16px 20px" }}>
      <h3
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
          margin: "0 0 12px",
        }}
      >
        {allRead ? "All caught up" : "Needs your attention"}
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
        {ALERTS.map((alert) => {
          const isRead = dismissedIds.has(alert.id);
          return (
            <li
              key={alert.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 12,
                alignItems: "start",
                opacity: isRead ? 0.5 : 1,
                transition: "opacity 0.2s ease",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 4,
                  alignSelf: "stretch",
                  borderRadius: 4,
                  background: alert.severity === "warn" ? "#E67E22" : "#1F6B49",
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {alert.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.6)",
                    marginTop: 2,
                    lineHeight: 1.45,
                  }}
                >
                  {alert.body}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.4)",
                    marginTop: 4,
                  }}
                >
                  {alert.when}
                  {isRead ? " · read" : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
