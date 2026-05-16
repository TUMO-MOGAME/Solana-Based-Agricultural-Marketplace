"use client";

// Mazra'at albaan — dashboard.
//
// 3-column shell: left sidebar / profile header + tabbed content / right rail.
// Right rail is a simple inline alerts list — drought triggers, repayment
// reminders, supplier updates.
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
import { PublicKey } from "@solana/web3.js";
import { useFarmerWallet } from "@/lib/vuna/farmer-wallet";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { fetchPackMeta, type PackMeta } from "@/lib/supabase/pack-meta";
import { LanguagePicker } from "@/lib/i18n/language-picker";
import { useT, translateStatus } from "@/lib/i18n/provider";
import { readDemoUser, clearDemoUser } from "@/lib/vuna/demo-user";
import { WalletButton } from "@/lib/vuna/wallet-button";
import {
  fetchGrowPack,
  fetchFarmerAccount,
  getConnection,
  farmerIdHashFrom,
  farmerPda,
  packPda,
  fetchDeal,
  fetchDealsByWallet,
  REGION_LABELS,
  type GrowPack,
  type FarmerAccount,
  type Deal,
} from "@/lib/vuna/program";
import { readDemoDeals, type DemoDeal } from "@/lib/vuna/demo-deals";
import { ApplyTab } from "./apply-tab";
import { MarketplaceTab } from "./marketplace-tab";
import { ListenButton } from "@/lib/vuna/listen-button";
import {
  useDashboardTour,
  TourMenuItem,
  TourOverlay,
  type TourTabId,
} from "@/lib/vuna/dashboard-tour";
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
// `labelKey` is resolved via the i18n `t()` helper at render time so the
// strings switch when the user changes language.
const PROFILE_TABS: Array<{ id: ProfileTab; labelKey: "tab.active" | "tab.apply" | "tab.insurance" | "tab.history" | "tab.about" }> = [
  { id: "active", labelKey: "tab.active" },
  { id: "apply", labelKey: "tab.apply" },
  { id: "insurance", labelKey: "tab.insurance" },
  { id: "history", labelKey: "tab.history" },
  { id: "about", labelKey: "tab.about" },
];

// localStorage key for the IDs of alerts the user has dismissed via
// the bell. Persisted across reloads so the unread badge stays cleared.
const DISMISSED_ALERTS_KEY = "vuna.dismissedAlerts";

/** The demo Grow Pack we created via scripts/setup-devnet-demo.mjs. */
const DEMO_PACK_ADDRESS = "AShtE5mNczJqoLYSQzASMHb5vLiAb3RSavPoLW4NyzAd";

type DashUser = { name: string; email: string };

/** Snapshot of the connected farmer's on-chain state, fetched once at
 *  the page level and threaded down to ActiveTab + AlertsList + AboutTab.
 *  No mock data — what you see here is what's on the chain right now. */
type FarmerSnapshot = {
  loading: boolean;
  error: string | null;
  /** Connected farmer's PDA, null when no wallet. */
  farmerAccount: FarmerAccount | null;
  /** Current-season GrowPack, null if the farmer hasn't applied yet. */
  pack: GrowPack | null;
  packAddress: string | null;
  /** Off-chain crop + hectares for the current pack. Null when Supabase
   *  is unconfigured, when the pack pre-dates pack_meta, or on demo-mode. */
  packMeta: PackMeta | null;
};

const EMPTY_SNAPSHOT: FarmerSnapshot = {
  loading: false,
  error: null,
  farmerAccount: null,
  pack: null,
  packAddress: null,
  packMeta: null,
};

type DashAlert = {
  id: string;
  severity: "warn" | "info";
  title: string;
  body: string;
};

const ZAR_FMT = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });

/** Derive the right-rail alerts from the connected farmer's real pack
 *  state. Returns an empty list when there's nothing on-chain to flag —
 *  no fabrication. IDs include the pack PDA so dismissals don't bleed
 *  across packs / seasons / browsers. */
function deriveAlerts(s: FarmerSnapshot): DashAlert[] {
  if (!s.pack || !s.packAddress) return [];
  const p = s.pack;
  const id = (suffix: string) => `${s.packAddress}:${suffix}`;
  const out: DashAlert[] = [];

  if (p.status === "Requested") {
    out.push({
      id: id("awaiting-approval"),
      severity: "info",
      title: "Awaiting co-op approval",
      body: "Your application is in review. The cooperative typically responds within 48 hours.",
    });
  }

  if (p.status === "Approved") {
    out.push({
      id: id("awaiting-disbursement"),
      severity: "info",
      title: "Awaiting disbursement",
      body: "Your application is approved. Inputs (seeds, fertilizer) are on their way from suppliers.",
    });
  }

  if (p.status === "Active") {
    if (p.rainfallPercentOfNorm > 0 && p.rainfallPercentOfNorm < p.thresholdPercent) {
      out.push({
        id: id("rainfall-low"),
        severity: "warn",
        title: "Rainfall watch",
        body: `Latest observation: ${p.rainfallPercentOfNorm}% of normal. Threshold ${p.thresholdPercent}% — drought cover may pay out soon.`,
      });
    } else if (p.rainfallPercentOfNorm > 0) {
      out.push({
        id: id("rainfall-ok"),
        severity: "info",
        title: "Rainfall normal",
        body: `Latest observation: ${p.rainfallPercentOfNorm}% of norm. Threshold not breached.`,
      });
    } else {
      out.push({
        id: id("cover-active"),
        severity: "info",
        title: "Drought cover active",
        body: `Cover is live for the season. We pay out automatically if rainfall drops below ${p.thresholdPercent}% of norm.`,
      });
    }
  }

  if (p.status === "InsurancePaid") {
    out.push({
      id: id("payout-sent"),
      severity: "info",
      title: "Drought payout sent",
      body: `R ${ZAR_FMT.format(Number(p.insurancePayout))} sent to your account. No claim form, no waiting.`,
    });
  }

  if (p.status === "Repaid") {
    out.push({
      id: id("repaid"),
      severity: "info",
      title: "Pack repaid",
      body: "Harvest sale closed and repayment settled. Ready to apply for next season.",
    });
  }

  if (p.status === "Defaulted") {
    out.push({
      id: id("defaulted"),
      severity: "warn",
      title: "Pack closed without repayment",
      body: "Talk to your co-op about replanting options or a credit-history reset path.",
    });
  }

  return out;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useT();
  const [user, setUser] = useState<DashUser | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("active");
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(
    new Set(),
  );
  // Pulses the Wallet sidebar item while the guided tour is on the
  // wallet step. Reset by the tour on stop / step-change.
  const [walletHighlighted, setWalletHighlighted] = useState(false);
  const { publicKey: walletPubkey, connect: connectWallet } = useFarmerWallet();

  // ─── Real on-chain snapshot for the connected farmer ────────────
  // One fetch at the page level; ActiveTab + AlertsList + AboutTab read
  // from the same data so we don't make 3 RPC round-trips for one page.
  const [snapshot, setSnapshot] = useState<FarmerSnapshot>(EMPTY_SNAPSHOT);
  useEffect(() => {
    if (!walletPubkey) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    let cancelled = false;
    setSnapshot((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      try {
        const conn = getConnection();
        const farmerIdHash = await farmerIdHashFrom(walletPubkey.toBase58());
        const [farmerAcc] = farmerPda(walletPubkey, farmerIdHash);
        const seasonId = new Date().getFullYear();
        const [packAcc] = packPda(farmerAcc, seasonId);
        const packAddress = packAcc.toBase58();
        const [farmerAccount, pack, packMeta] = await Promise.all([
          fetchFarmerAccount(conn, farmerAcc),
          fetchGrowPack(conn, packAcc),
          fetchPackMeta(packAddress),
        ]);
        if (cancelled) return;
        setSnapshot({
          loading: false,
          error: null,
          farmerAccount,
          pack,
          packAddress,
          packMeta,
        });
      } catch (e) {
        if (cancelled) return;
        setSnapshot({
          loading: false,
          error: e instanceof Error ? e.message : String(e),
          farmerAccount: null,
          pack: null,
          packAddress: null,
          packMeta: null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletPubkey]);

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

  // Dismiss whatever alerts are currently derived from real pack state.
  // We persist the IDs so the badge stays cleared across reloads, even
  // though the underlying alerts may recalculate on every fetch.
  const dismissAllAlerts = (alertIds: string[]) => {
    if (alertIds.length === 0) return;
    setDismissedAlertIds((prev) => {
      const next = new Set(prev);
      alertIds.forEach((id) => next.add(id));
      try {
        window.localStorage.setItem(
          DISMISSED_ALERTS_KEY,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        /* private mode / quota — UI state still updates for this session */
      }
      return next;
    });
  };

  // Supabase user load (or stub in demo mode)
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // In demo mode, prefer values captured at signup/login. Falls back
      // to the generic stub when nothing has been stored yet (e.g. fresh
      // browser, or someone deep-linked to /dashboard before signing up).
      const stored = readDemoUser();
      const fallbackName = stored.email
        ? stored.email.split("@")[0]?.replace(/[._-]+/g, " ") || stored.email
        : "Demo Farmer";
      setUser({
        name: stored.name?.trim() || fallbackName,
        email: stored.email?.trim() || "demo@mazraat.local",
      });
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

  // ─── Guided voice tour ───────────────────────────────────────────
  // Hook is called *before* the early `if (!user) return null` so React's
  // hook order stays stable across renders. The hook stores ctx + callbacks
  // in refs internally, so it tolerates being instantiated with placeholder
  // values on first render and reading the real ones once user loads.
  const walletShortForTour = walletPubkey
    ? `${walletPubkey.toBase58().slice(0, 4)}…${walletPubkey.toBase58().slice(-4)}`
    : null;
  // Real region from FarmerAccount when we have it; tour falls back to
  // a generic line if the farmer hasn't registered yet.
  const tourRegion =
    snapshot.farmerAccount &&
    snapshot.farmerAccount.region < REGION_LABELS.length
      ? REGION_LABELS[snapshot.farmerAccount.region]
      : null;
  const tour = useDashboardTour(
    {
      firstName: user?.name?.split(" ")[0] ?? user?.name ?? "",
      walletShort: walletShortForTour,
      region: tourRegion,
    },
    {
      onNavigateToTab: (tab: TourTabId) => {
        setProfileTab(tab as ProfileTab);
        setLeftOpen(false);
        setRightOpen(false);
      },
      onHighlightWallet: setWalletHighlighted,
    },
  );

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
      } catch {
        /* offline — fall through to redirect */
      }
    } else {
      // Demo mode: drop the cached user so the next demo session
      // starts fresh and doesn't leak the previous person's name.
      clearDemoUser();
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
      label: t("nav.home"),
      active: profileTab === "active",
      onClick: () => goToTab("active"),
    },
    {
      icon: Sprout,
      label: t("nav.apply"),
      active: profileTab === "apply",
      onClick: () => goToTab("apply"),
    },
    {
      icon: ShieldCheck,
      label: t("nav.insurance"),
      active: profileTab === "insurance",
      onClick: () => goToTab("insurance"),
    },
    {
      icon: Wallet,
      label: t("nav.wallet"),
      meta: walletShort ?? undefined,
      highlightTour: walletHighlighted,
      onClick: () => {
        if (!walletPubkey) void connectWallet();
        // If connected, the meta badge already shows the address — clicking
        // again is a no-op (use the right-rail button to disconnect).
      },
    },
    {
      icon: ShoppingBag,
      label: t("nav.marketplace"),
      active: profileTab === "marketplace",
      onClick: () => goToTab("marketplace"),
    },
  ];

  const liveAlerts = deriveAlerts(snapshot);
  const unreadCount = liveAlerts.filter((a) => !dismissedAlertIds.has(a.id)).length;

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
          <img
            src="/brand/logo-mark-256.png"
            alt="Mazra'at albaan"
            width={34}
            height={34}
            className={styles.logoMark}
          />
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
              const highlightTour =
                "highlightTour" in item ? item.highlightTour : false;
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
                  } ${highlightTour ? styles.tourHighlight : ""}`}
                  onClick={item.onClick}
                >
                  <Icon />
                  <span>{item.label}</span>
                  {Meta}
                </button>
              );
            })}
            {/* Voice tour — sits under Marketplace per the design ask. Plays
                a short narration and drives tab navigation as it speaks. */}
            <TourMenuItem
              tour={tour}
              className={styles.menuItem}
              metaClassName={styles.menuItemMeta}
            />
          </nav>
        </div>

        <div className={styles.sidebarFooter}>
          <LanguagePicker />
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
                  {tourRegion ? `Smallholder · ${tourRegion}` : "Smallholder"}
                </div>
              </div>
            </div>

            <nav className={styles.profileMenu} aria-label="Profile sections">
              {PROFILE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`${styles.profileMenuLink} ${
                    profileTab === tab.id ? styles.active : ""
                  }`}
                  onClick={() => setProfileTab(tab.id)}
                  aria-current={profileTab === tab.id ? "page" : undefined}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </nav>
          </section>

          {/* Tabbed body */}
          {profileTab === "active" ? (
            <ActiveTab
              firstName={firstName}
              snapshot={snapshot}
              walletConnected={walletPubkey !== null}
              onApplyClick={() => goToTab("apply")}
              onConnectClick={connectWallet}
            />
          ) : profileTab === "apply" ? (
            <ApplyTab onNavigateToInsurance={() => goToTab("insurance")} />
          ) : profileTab === "insurance" ? (
            <InsuranceTab />
          ) : profileTab === "about" ? (
            <AboutTab user={user} regionLabel={tourRegion} />
          ) : profileTab === "marketplace" ? (
            <MarketplaceTab />
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
              if (unreadCount > 0) dismissAllAlerts(liveAlerts.map((a) => a.id));
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
          <AlertsList alerts={liveAlerts} dismissedIds={dismissedAlertIds} />
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

      {/* Floating progress panel shown only while the guided tour is running */}
      <TourOverlay tour={tour} />
    </div>
  );
}

// ============================================================================
//  Tabs
// ============================================================================

function ActiveTab({
  firstName,
  snapshot,
  walletConnected,
  onApplyClick,
  onConnectClick,
}: {
  firstName: string;
  snapshot: FarmerSnapshot;
  walletConnected: boolean;
  onApplyClick: () => void;
  onConnectClick: () => void | Promise<void>;
}) {
  const { t } = useT();
  // ─── State 1: no wallet ─────────────────────────────────────────
  if (!walletConnected) {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>Sawubona, {firstName}</h2>
          </div>
          <div className={styles.boxBody}>
            <p
              style={{
                fontSize: 13,
                color: "rgba(255, 230, 210, 0.72)",
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              Connect your wallet to load your real Grow Pack and credit
              history. Nothing on this screen is fabricated — it&apos;s all
              read straight from the chain.
            </p>
            <button
              type="button"
              onClick={() => void onConnectClick()}
              className={styles.sessionCTA}
              style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Connect wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── State 2: loading ───────────────────────────────────────────
  if (snapshot.loading) {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.box}>
          <div
            className={styles.boxBody}
            style={{ textAlign: "center", padding: 28 }}
          >
            <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.55)" }}>
              Reading your account from devnet…
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── State 3: error ─────────────────────────────────────────────
  if (snapshot.error) {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>Couldn&apos;t reach the chain</h2>
          </div>
          <div className={styles.boxBody}>
            <span style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.55)" }}>
              {snapshot.error}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const { farmerAccount, pack } = snapshot;

  // ─── State 4: wallet connected, no farmer registered yet ─────────
  if (!farmerAccount) {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>Welcome, {firstName}</h2>
          </div>
          <div className={styles.boxBody}>
            <p
              style={{
                fontSize: 13,
                color: "rgba(255, 230, 210, 0.72)",
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              You don&apos;t have a Grow Pack on chain yet. Apply once and
              we&apos;ll register you with the cooperative, set up your
              insurance cover, and book the credit — all in one go.
            </p>
            <button
              type="button"
              onClick={onApplyClick}
              className={styles.sessionCTA}
              style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Apply for your first Grow Pack
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Farmer registered — pull real region from FarmerAccount.
  const regionLabel =
    farmerAccount.region < REGION_LABELS.length
      ? REGION_LABELS[farmerAccount.region]
      : `Region ${farmerAccount.region}`;
  const currentYear = new Date().getFullYear();

  // ─── State 5: registered but no current-season pack ─────────────
  if (!pack) {
    return (
      <div className={styles.timelineSingle}>
        <div className={styles.timelinePair}>
          <div className={styles.box}>
            <div className={styles.boxHeader}>
              <h2 className={styles.boxTitle}>Sawubona, {firstName}</h2>
              <span className={styles.boxLabel}>Registered</span>
            </div>
            <div className={styles.boxBody}>
              <div className={styles.introItem}>
                <MapPin />
                <span>{regionLabel}</span>
              </div>
              <div className={styles.introItem}>
                <CalendarDays />
                <span>
                  No Grow Pack for <strong>{currentYear}</strong> yet
                </span>
              </div>
            </div>
          </div>

          <div className={`${styles.box} ${styles.session}`}>
            <div className={styles.sessionEyebrow}>
              <span className={styles.sessionDot} />
              Your credit history
            </div>
            <h3 className={styles.sessionTitle}>{farmerAccount.score}</h3>
            <p className={styles.sessionSubtitle}>
              {farmerAccount.totalPacks} pack
              {farmerAccount.totalPacks === 1 ? "" : "s"} ·{" "}
              {farmerAccount.successfulRepayments} repaid ·{" "}
              {farmerAccount.defaults} default
              {farmerAccount.defaults === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={onApplyClick}
              className={styles.sessionCTA}
              style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Apply for {currentYear}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── State 6: registered AND has a current-season pack ──────────
  // Everything below comes straight from on-chain GrowPack + FarmerAccount.

  const totalRepaymentZAR = ZAR_FMT.format(Number(pack.totalRepayment));
  const bundleCostZAR = ZAR_FMT.format(Number(pack.bundleCost));
  const maxPayoutZAR = ZAR_FMT.format(Number(pack.maxPayout));
  const insurancePayoutZAR = ZAR_FMT.format(Number(pack.insurancePayout));

  const cropPhrase = snapshot.packMeta
    ? `${snapshot.packMeta.crop} on ${snapshot.packMeta.hectares} hectares`
    : "your Grow Pack";
  const localisedStatus = translateStatus(pack.status, t);
  const greetingLine = `Hello ${firstName}. ${cropPhrase} for season ${pack.seasonId} in ${regionLabel} is currently ${localisedStatus}. Repayment of about ${totalRepaymentZAR} Rand is due at harvest.`;

  return (
    <div className={styles.timelineSingle}>
      <div className={styles.timelinePair}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>Sawubona, {firstName}</h2>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <ListenButton
                size="sm"
                text={greetingLine}
                ariaLabel="Listen — your daily summary, read aloud"
              />
              <span className={styles.boxLabel}>{localisedStatus}</span>
            </div>
          </div>
          <div className={styles.boxBody}>
            <div className={styles.introItem}>
              <CalendarDays />
              <span>
                Season <strong>{pack.seasonId}</strong>
              </span>
            </div>
            <div className={styles.introItem}>
              <MapPin />
              <span>{regionLabel}</span>
            </div>
            {snapshot.packMeta ? (
              <div className={styles.introItem}>
                <Sprout />
                <span>
                  <strong>{snapshot.packMeta.crop}</strong> ·{" "}
                  {snapshot.packMeta.hectares} ha
                </span>
              </div>
            ) : null}
            <div className={styles.introItem}>
              <Sprout />
              <span>
                Repay at harvest: <strong>R {totalRepaymentZAR}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className={`${styles.box} ${styles.session}`}>
          <div className={styles.sessionEyebrow}>
            <span className={styles.sessionDot} />
            {t("active.title")}
          </div>
          <h3 className={styles.sessionTitle}>R {bundleCostZAR}</h3>
          <p className={styles.sessionSubtitle}>
            {t("active.bundle_today")} · {t("active.repay_after_harvest")} R {totalRepaymentZAR}
          </p>
          <ul
            style={{
              marginTop: 16,
              listStyle: "none",
              padding: 0,
              display: "grid",
              gap: 6,
              fontSize: 12,
              color: "rgba(255, 230, 210, 0.72)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <li>
              {t("active.drought_threshold")}: <strong>{pack.thresholdPercent}%</strong> {t("active.norm_rainfall")}
            </li>
            <li>
              {t("active.max_payout")}: <strong>R {maxPayoutZAR}</strong>
            </li>
            {pack.rainfallPercentOfNorm > 0 ? (
              <li>
                {t("active.latest_obs")}:{" "}
                <strong>{pack.rainfallPercentOfNorm}%</strong> {t("active.of_norm")}
              </li>
            ) : null}
            {pack.insurancePayout > 0n ? (
              <li>
                {t("active.insurance_paid")}: <strong>R {insurancePayoutZAR}</strong>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className={styles.timelinePair}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>Rainfall</h2>
            <span className={styles.boxLabel}>
              {pack.rainfallPercentOfNorm === 0
                ? "Awaiting"
                : pack.rainfallPercentOfNorm < pack.thresholdPercent
                ? "Below threshold"
                : "Above threshold"}
            </span>
          </div>
          <div className={styles.boxBody}>
            <div className={styles.introItem}>
              <Droplets />
              <span>
                {pack.rainfallPercentOfNorm === 0
                  ? "No observation recorded yet — your co-op will record one as the season progresses."
                  : `Latest: ${pack.rainfallPercentOfNorm}% of seasonal norm. Threshold ${pack.thresholdPercent}%.`}
              </span>
            </div>
          </div>
        </div>

        <div className={`${styles.box} ${styles.session}`}>
          <div className={styles.sessionEyebrow}>
            <span className={styles.sessionDot} />
            Your credit history
          </div>
          <h3 className={styles.sessionTitle}>{farmerAccount.score}</h3>
          <p className={styles.sessionSubtitle}>
            {farmerAccount.totalPacks} pack
            {farmerAccount.totalPacks === 1 ? "" : "s"} ·{" "}
            {farmerAccount.successfulRepayments} repaid ·{" "}
            {farmerAccount.defaults} default
            {farmerAccount.defaults === 1 ? "" : "s"}
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
  const { publicKey: walletPubkey } = useFarmerWallet();
  const { t } = useT();
  const [pack, setPack] = useState<GrowPack | null>(null);
  const [packMeta, setPackMeta] = useState<PackMeta | null>(null);
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
        const pubkeyStr = pubkey.toBase58();
        setPackAddress(pubkeyStr);
        setIsPreview(preview);

        const [data, meta] = await Promise.all([
          fetchGrowPack(conn, pubkey),
          fetchPackMeta(pubkeyStr),
        ]);
        if (cancelled) return;
        setPackMeta(meta);
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
            {triggered ? t("insurance.payout_sent") : t("insurance.no_payout")}
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
          {triggered ? t("insurance.sent_msg") : t("insurance.cover_active")}
        </p>
      </div>

      <div className={styles.timelinePair}>
        {/* Why you were paid */}
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>
              {triggered ? t("insurance.why_paid") : t("insurance.rain_obs")}
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
            <span className={styles.boxLabel}>{translateStatus(pack.status, t)}</span>
          </div>
          <div className={styles.boxBody}>
            {packMeta ? (
              <DetailRow
                label={t("common.crop")}
                value={`${packMeta.crop} · ${packMeta.hectares} ha`}
              />
            ) : null}
            <DetailRow label={t("common.bundle_cost")} value={formatRand(pack.bundleCost)} />
            <DetailRow label="Service fee" value={formatRand(pack.serviceFee)} />
            <DetailRow label={t("common.total_repayment")} value={formatRand(pack.totalRepayment)} />
            <DetailRow label="Threshold" value={`${pack.thresholdPercent}% ${t("active.of_norm")}`} />
            <DetailRow label={t("active.max_payout")} value={formatRand(pack.maxPayout)} />
            <DetailRow label={t("common.insurance_payout")} value={formatRand(pack.insurancePayout)} highlight />
            <DetailRow label={t("common.pack")} value={shortPackId(packAddress)} mono />
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
  meta: PackMeta | null;
};

function HistoryTab({ onViewPack }: { onViewPack: () => void }) {
  const { publicKey: walletPubkey } = useFarmerWallet();
  const { t } = useT();
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
        // simply come back as nulls. pack_meta is fetched alongside so
        // History can show crop + hectares for each season.
        const fetched = await Promise.all(
          seasons.map(async (season) => {
            const [packAcc] = packPda(farmerAcc, season);
            const address = packAcc.toBase58();
            const [data, meta] = await Promise.all([
              fetchGrowPack(conn, packAcc),
              fetchPackMeta(address),
            ]);
            return { season, address, data, meta };
          }),
        );

        if (cancelled) return;

        const existing: HistoryRow[] = fetched
          .filter(
            (r): r is { season: number; address: string; data: GrowPack; meta: PackMeta | null } =>
              r.data !== null,
          )
          .map(({ season, address, data, meta }) => ({ season, address, pack: data, meta }));

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
            <h2 className={styles.boxTitle}>{t("tab.history")}</h2>
          </div>
          <div className={styles.boxBody}>
            <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.72)" }}>
              {t("history.connect")}
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
              {t("history.loading")}
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
            <h2 className={styles.boxTitle}>{t("common.couldnt_reach_chain")}</h2>
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
            <h2 className={styles.boxTitle}>{t("history.no_packs")}</h2>
          </div>
          <div className={styles.boxBody}>
            <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.72)" }}>
              {t("history.empty_body")}
            </span>
          </div>
        </div>
        {/* Even without Grow Packs, surface marketplace deals if any. */}
        <DealHistorySection />
      </div>
    );
  }

  return (
    <div className={styles.timelineSingle}>
      <SectionHeader>{t("history.title")}</SectionHeader>
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => (
          <HistoryCard key={row.address} row={row} onView={onViewPack} />
        ))}
      </div>
      <DealHistorySection />
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "rgba(255, 230, 210, 0.55)",
        fontWeight: 700,
        padding: "0 4px",
        marginTop: 8,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
//  Deal history (Phase 2/3 marketplace deals)
// ============================================================================
//
// Reads from two sources:
//  1. localStorage cache (`vuna.demoDeals`) — survives PDA closure on
//     release, so this is where released-deal records live.
//  2. On-chain scan via `fetchDealsByWallet` — finds active deals where
//     the connected wallet is buyer or farmer, even on a fresh browser
//     where localStorage is empty.
//
// Merged by PDA. Empty / no-wallet / error states render NOTHING (vs.
// a placeholder card) so the Past-Grow-Packs section sits cleanly above.

type DealHistoryRow = {
  cached: DemoDeal;
  onChain: Deal | null;
};

function DealHistorySection() {
  const { publicKey } = useFarmerWallet();
  const [rows, setRows] = useState<DealHistoryRow[]>([]);
  const [state, setState] = useState<
    "loading" | "ready" | "no-wallet" | "empty" | "error"
  >("loading");

  useEffect(() => {
    if (!publicKey) {
      setState("no-wallet");
      setRows([]);
      return;
    }
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const conn = getConnection();
        const me = publicKey.toBase58();
        const myCached = readDemoDeals().filter(
          (d) => d.buyer === me || d.farmer === me,
        );
        const [enrichedCached, scanned] = await Promise.all([
          Promise.all(
            myCached.map(async (d) => {
              try {
                const onChain = await fetchDeal(conn, new PublicKey(d.pda));
                return { cached: d, onChain };
              } catch {
                return { cached: d, onChain: null };
              }
            }),
          ),
          (async () => {
            try {
              return await fetchDealsByWallet(conn, publicKey);
            } catch {
              return [];
            }
          })(),
        ]);
        if (cancelled) return;

        const byPda = new Map<string, DealHistoryRow>();
        for (const r of enrichedCached) byPda.set(r.cached.pda, r);
        for (const { address, deal } of scanned) {
          const pdaStr = address.toBase58();
          if (byPda.has(pdaStr)) continue;
          byPda.set(pdaStr, {
            cached: {
              pda: pdaStr,
              buyer: deal.buyer.toBase58(),
              farmer: deal.farmer.toBase58(),
              dealId: deal.dealId.toString(),
              amountLamports: deal.amountLamports.toString(),
              createdAtMs: Number(deal.createdAt) * 1000,
            },
            onChain: deal,
          });
        }
        const all = Array.from(byPda.values()).sort(
          (a, b) => b.cached.createdAtMs - a.cached.createdAtMs,
        );
        setRows(all);
        setState(all.length > 0 ? "ready" : "empty");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  // Hide the section entirely when there's nothing to show, instead of
  // rendering a placeholder. Keeps the History tab clean for users who
  // haven't touched the marketplace yet.
  if (state !== "ready" || !publicKey) return null;

  return (
    <>
      <SectionHeader>Marketplace deals</SectionHeader>
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => (
          <DealHistoryCard
            key={row.cached.pda}
            row={row}
            myWallet={publicKey.toBase58()}
          />
        ))}
      </div>
    </>
  );
}

function DealHistoryCard({
  row,
  myWallet,
}: {
  row: DealHistoryRow;
  myWallet: string;
}) {
  const { cached, onChain } = row;
  const released = onChain === null;
  const isBuyer = cached.buyer === myWallet;

  const lamports = onChain
    ? Number(onChain.amountLamports)
    : Number(BigInt(cached.amountLamports));
  const sol = lamports / 1_000_000_000;
  const randApprox = Math.round(sol * 1000);

  const statusLabel = released ? "Released" : "Active";
  const statusColor = released ? "#7adf7d" : "#ffb86b";

  const sideCopy = isBuyer
    ? released
      ? "You bought — funds delivered."
      : "You committed funds — awaiting farmer confirmation."
    : released
      ? "You sold — funds received."
      : "Locked for you — confirm in the Marketplace tab."

  const created = new Date(cached.createdAtMs).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className={styles.box}>
      <div className={styles.boxBody}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "rgba(255, 245, 230, 0.95)",
                marginBottom: 4,
              }}
            >
              {cached.buyerOfferLabel ?? "Marketplace deal"}
            </div>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                color: "rgba(255, 230, 210, 0.45)",
                display: "grid",
                gap: 2,
              }}
            >
              <div>buyer  {shortPackId(cached.buyer)}</div>
              <div>farmer {shortPackId(cached.farmer)}</div>
              <div>deal   {shortPackId(cached.pda)}</div>
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: statusColor,
              padding: "3px 9px",
              borderRadius: 999,
              border: `1px solid ${statusColor}55`,
              background: `${statusColor}14`,
              flexShrink: 0,
            }}
          >
            {statusLabel}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "rgba(255, 245, 230, 0.95)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ≈ R {randApprox} ({sol.toFixed(3)} SOL)
          </span>
          <span style={{ fontSize: 11, color: "rgba(255, 230, 210, 0.45)" }}>
            {created}
          </span>
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "rgba(255, 230, 210, 0.6)",
            lineHeight: 1.45,
          }}
        >
          {sideCopy}
        </div>
      </div>
    </div>
  );
}

function HistoryCard({ row, onView }: { row: HistoryRow; onView: () => void }) {
  const { t } = useT();
  const { season, address, pack, meta } = row;
  const currentYear = new Date().getFullYear();
  const isCurrent = season === currentYear;

  // settle_repayment has fired if any of these post-harvest fields are
  // non-zero — the on-chain struct zero-initialises them, so any value
  // means the cooperative ran settle_repayment.
  const isClosed =
    pack.status === "Repaid" || pack.status === "Defaulted";
  const showSettleDetail =
    isClosed || pack.saleProceeds > 0n || pack.repaid > 0n;

  return (
    <div className={styles.box}>
      <div className={styles.boxHeader}>
        <h2 className={styles.boxTitle}>{t("history.season")} {season}</h2>
        <span className={styles.boxLabel}>
          {isCurrent ? t("history.current") : t("history.past")}
        </span>
      </div>
      <div className={styles.boxBody}>
        <DetailRow label={t("common.status")} value={translateStatus(pack.status, t)} highlight />
        {meta ? (
          <DetailRow
            label={t("common.crop")}
            value={`${meta.crop} · ${meta.hectares} ha`}
          />
        ) : null}
        <DetailRow label={t("common.bundle_cost")} value={formatRand(pack.bundleCost)} />
        <DetailRow label={t("common.total_repayment")} value={formatRand(pack.totalRepayment)} />
        {pack.insurancePayout > 0n ? (
          <DetailRow
            label={t("common.insurance_payout")}
            value={formatRand(pack.insurancePayout)}
          />
        ) : null}
        {showSettleDetail ? (
          <>
            <DetailRow
              label={t("history.harvest_sale")}
              value={formatRand(pack.saleProceeds)}
            />
            <DetailRow
              label={t("history.repaid")}
              value={formatRand(pack.repaid)}
              highlight
            />
            {pack.surplus > 0n ? (
              <DetailRow
                label={t("history.surplus_to_you")}
                value={formatRand(pack.surplus)}
              />
            ) : null}
            {pack.defaulted > 0n ? (
              <DetailRow
                label={t("history.outstanding")}
                value={formatRand(pack.defaulted)}
              />
            ) : null}
          </>
        ) : null}
        <DetailRow label={t("common.pack")} value={shortPackId(address)} mono />
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
            {t("history.view_insurance")} →
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AboutTab({
  user,
  regionLabel,
}: {
  user: DashUser;
  regionLabel: string | null;
}) {
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
              {regionLabel
                ? <>Smallholder registered with the <strong>{regionLabel}</strong> cooperative</>
                : "Smallholder — not yet registered on chain"}
            </span>
          </div>
          {regionLabel ? (
            <div className={styles.introItem}>
              <MapPin />
              <span>
                Based in <strong>{regionLabel}, SA</strong>
              </span>
            </div>
          ) : null}
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

function AlertsList({
  alerts,
  dismissedIds,
}: {
  alerts: DashAlert[];
  dismissedIds: Set<string>;
}) {
  // Empty state — nothing on-chain to flag yet (no wallet, or no
  // current-season pack, or all alerts dismissed). Honest "all quiet"
  // beats fabricated "rainfall watch" in an empty state.
  if (alerts.length === 0) {
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
          All quiet
        </h3>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255, 230, 210, 0.55)",
            lineHeight: 1.5,
          }}
        >
          We&apos;ll surface drought watches, payouts, and repayment reminders
          here once your Grow Pack is on chain.
        </div>
      </div>
    );
  }

  const allRead = alerts.every((a) => dismissedIds.has(a.id));

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
        {alerts.map((alert) => {
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
                {isRead ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 4,
                    }}
                  >
                    read
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
