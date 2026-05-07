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
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { WalletButton } from "@/lib/vuna/wallet-button";
import styles from "./dashboard.module.css";

type ProfileTab = "active" | "history" | "about";

const PROFILE_TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: "active", label: "Active" },
  { id: "history", label: "History" },
  { id: "about", label: "About" },
];

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
  const [notifOpen, setNotifOpen] = useState(false);
  const { publicKey: walletPubkey } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

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
      href: "/grow-pack/new",
    },
    {
      icon: ShieldCheck,
      label: "Insurance",
      href: "/insurance/AShtE5mNczJqoLYSQzASMHb5vLiAb3RSavPoLW4NyzAd",
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
      onClick: () => {
        /* not yet built — see app/CLAUDE.md roadmap */
      },
    },
  ];

  const unreadCount = ALERTS.length;

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
              placeholder="Search farmers, packs, suppliers…"
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
                  background: "#0B3D2E",
                  color: "#E8B931",
                  fontWeight: 700,
                  fontSize: 28,
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
            <ActiveTab firstName={firstName} />
          ) : profileTab === "about" ? (
            <AboutTab user={user} />
          ) : (
            <ComingSoon label="History" />
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

          {/* Bell with unread badge */}
          <button
            type="button"
            className={`${styles.accountBtn} ${notifOpen ? styles.active : ""}`}
            aria-label={
              unreadCount > 0
                ? `Alerts (${unreadCount} unread)`
                : "Alerts"
            }
            aria-expanded={notifOpen}
            title={
              unreadCount > 0 ? `${unreadCount} unread alerts` : "Alerts"
            }
            onClick={() => setNotifOpen((v) => !v)}
            style={{ position: "relative" }}
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
          <AlertsList />
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

function ActiveTab({ firstName }: { firstName: string }) {
  const pct = Math.round(
    (ACTIVE_PACK.dayOfSeason / ACTIVE_PACK.totalDays) * 100,
  );

  return (
    <div className={styles.timelineSingle}>
      <div className={styles.timelinePair}>
        <div className={styles.box}>
          <div className={styles.boxHeader}>
            <h2 className={styles.boxTitle}>Sawubona, {firstName}</h2>
            <span className={styles.boxLabel}>Active</span>
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
          <Link
            href="/grow-pack/new"
            className={styles.sessionCTA}
          >
            Plan next season
          </Link>
        </div>
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

function AlertsList() {
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
        Needs your attention
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
        {ALERTS.map((alert) => (
          <li
            key={alert.id}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 12,
              alignItems: "start",
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
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
