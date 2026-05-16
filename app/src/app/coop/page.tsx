"use client";

// /coop — cooperative staff dashboard.
//
// Drives the on-chain Grow Pack lifecycle that, until now, only
// `app/scripts/setup-devnet-demo.mjs` could exercise:
//   approve_grow_pack → disburse_grow_pack → trigger_insurance_payout
//
// Three sections, one per status:
//   1. Pending applications (status: Requested)  → Approve
//   2. Awaiting disbursement (status: Approved) → Disburse
//   3. Active packs          (status: Active)   → Trigger drought payout
//
// Settle-repayment + farmer-registration UIs are intentionally out of
// scope per the agreed MVP — see CLAUDE.md tier-1 backlog.
//
// Wallet: uses @solana/wallet-adapter-react directly (Phantom popup),
// NOT useFarmerWallet() like the farmer dashboard. Co-op staff are
// technical users who already understand wallets — no Privy here.
// PrivyProvider may still be mounted at the layout root; that's fine,
// we just don't read from it.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Sprout,
  AlertCircle,
  ArrowLeft,
  Droplets,
  UserPlus,
  History,
  Users,
  Copy,
  Check,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  fetchAllGrowPacks,
  makeApproveGrowPackIx,
  makeDisburseGrowPackIx,
  makeTriggerInsurancePayoutIx,
  makeSettleRepaymentIx,
  makeRegisterFarmerIx,
  farmerIdHashFrom,
  type GrowPack,
} from "@/lib/vuna/program";
import { WalletButton } from "@/lib/vuna/wallet-button";
import dashStyles from "../dashboard/dashboard.module.css";

// ─── shared types + helpers ──────────────────────────────────────────

type Row = { address: PublicKey; pack: GrowPack };

const ZAR = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });
const formatRand = (n: bigint | number) =>
  `R ${ZAR.format(typeof n === "bigint" ? Number(n) : n)}`;
const shortPk = (pk: PublicKey | string): string => {
  const s = typeof pk === "string" ? pk : pk.toBase58();
  return s.length > 8 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
};

// ─── audit log ───────────────────────────────────────────────────────
// Persisted record of every action taken through /coop. Stored in
// localStorage so it survives reloads but never leaves the device.
// Capped at the most recent MAX_AUDIT entries — enough for a demo
// session, small enough to render flat without virtualisation.

const AUDIT_STORAGE_KEY = "vuna:coop:audit:v1";
const MAX_AUDIT = 50;

type AuditAction =
  | "approve"
  | "disburse"
  | "trigger"
  | "settle"
  | "register";

type AuditEntry = {
  id: string;
  ts: number;
  action: AuditAction;
  status: "ok" | "error";
  // For lifecycle actions: the pack PDA. For register: the farmer pubkey.
  target: string;
  // Optional human-readable label (e.g. season number, rainfall %, sale R).
  detail?: string;
  // Set on success.
  signature?: string;
  // Set on failure — pulled from program logs when available.
  errorMessage?: string;
  // Operator wallet at the time of the action.
  operator: string;
};

function loadAuditLog(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is AuditEntry =>
        Boolean(
          e &&
            typeof e === "object" &&
            typeof (e as AuditEntry).id === "string" &&
            typeof (e as AuditEntry).ts === "number" &&
            typeof (e as AuditEntry).action === "string",
        ),
      )
      .slice(0, MAX_AUDIT);
  } catch {
    return [];
  }
}

function saveAuditLog(entries: AuditEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      AUDIT_STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_AUDIT)),
    );
  } catch {
    // Quota exceeded or storage disabled — nothing useful we can do.
  }
}

function useAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  // Hydrate once on mount; SSR-safe.
  useEffect(() => {
    setEntries(loadAuditLog());
  }, []);

  const record = useCallback(
    (entry: Omit<AuditEntry, "id" | "ts">) => {
      setEntries((prev) => {
        const next: AuditEntry[] = [
          {
            ...entry,
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            ts: Date.now(),
          },
          ...prev,
        ].slice(0, MAX_AUDIT);
        saveAuditLog(next);
        return next;
      });
    },
    [],
  );

  const clear = useCallback(() => {
    setEntries([]);
    saveAuditLog([]);
  }, []);

  return { entries, record, clear };
}

// ─── page ────────────────────────────────────────────────────────────

export default function CoopPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connecting } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const audit = useAuditLog();

  const [rows, setRows] = useState<Row[]>([]);
  const [loadState, setLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Per-row "in flight" lock so a fast double-click can't fire two txs.
  const [busyAddress, setBusyAddress] = useState<string | null>(null);
  // Toast shown after a successful action.
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  // Read every pack on every refresh — cheap on devnet, indexer in prod.
  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setErrorMsg("");
    (async () => {
      try {
        const fetched = await fetchAllGrowPacks(connection);
        if (cancelled) return;
        // Newest seasons first; secondary sort by pack address for stability.
        fetched.sort((a, b) => {
          if (b.pack.seasonId !== a.pack.seasonId)
            return b.pack.seasonId - a.pack.seasonId;
          return a.address.toBase58().localeCompare(b.address.toBase58());
        });
        setRows(fetched);
        setLoadState("ready");
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, refreshKey]);

  // Group by status — simple O(n) scan, four buckets.
  //
  // `harvestReady` includes both Active and InsurancePaid packs because the
  // on-chain settle_repayment handler accepts both. An Active pack appears
  // in BOTH `active` (drought watch) AND `harvestReady` (harvest close) —
  // the operator chooses the right action for the season state.
  const buckets = useMemo(() => {
    const pending: Row[] = [];
    const approved: Row[] = [];
    const active: Row[] = [];
    const harvestReady: Row[] = [];
    for (const r of rows) {
      if (r.pack.status === "Requested") pending.push(r);
      else if (r.pack.status === "Approved") approved.push(r);
      else if (r.pack.status === "Active") {
        active.push(r);
        harvestReady.push(r);
      } else if (r.pack.status === "InsurancePaid") {
        harvestReady.push(r);
      }
    }
    return { pending, approved, active, harvestReady };
  }, [rows]);

  // Generic sign+send wrapper. `buildIx` is a closure over the chosen
  // encoder — keeps the per-section action handlers tiny.
  const signAndSend = useCallback(
    async (
      address: PublicKey,
      buildIx: (cooperative: PublicKey) => ReturnType<
        typeof makeApproveGrowPackIx
      >,
      okText: string,
      auditMeta: { action: AuditAction; detail?: string },
    ) => {
      if (!publicKey || !sendTransaction) {
        setWalletModalVisible(true);
        return;
      }
      setBusyAddress(address.toBase58());
      setToast(null);
      const operator = publicKey.toBase58();
      const target = address.toBase58();
      try {
        const tx = new Transaction().add(buildIx(publicKey));
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
        setToast({ kind: "ok", text: `${okText} — ${shortPk(sig)}` });
        audit.record({
          action: auditMeta.action,
          status: "ok",
          target,
          detail: auditMeta.detail,
          signature: sig,
          operator,
        });
        refresh();
      } catch (e) {
        // wallet-adapter wraps the underlying SendTransactionError as
        // `.error`. Pull the program logs out so the user sees the
        // actual cause ("UnauthorizedCooperative", "InvalidGrowPackStatus")
        // instead of the generic "Unexpected error" wrapper.
        let msg = e instanceof Error ? e.message : String(e);
        const cause = (e as { error?: unknown }).error;
        if (cause) {
          const logs = (cause as { logs?: string[] }).logs;
          if (Array.isArray(logs) && logs.length) {
            const programErr =
              logs.find((l) => /Program log:.*Error/i.test(l)) ??
              logs.find((l) => /failed: custom program error/i.test(l)) ??
              logs[logs.length - 1];
            msg = `${msg}\n${programErr}`;
          } else if (cause instanceof Error) {
            msg = cause.message;
          }
        }
        setToast({ kind: "err", text: msg });
        audit.record({
          action: auditMeta.action,
          status: "error",
          target,
          detail: auditMeta.detail,
          errorMessage: msg,
          operator,
        });
      } finally {
        setBusyAddress(null);
      }
    },
    [publicKey, sendTransaction, connection, setWalletModalVisible, refresh, audit],
  );

  const onApprove = useCallback(
    (row: Row) =>
      signAndSend(
        row.address,
        (cooperative) =>
          makeApproveGrowPackIx({
            cooperative,
            farmer: row.pack.farmer,
            pack: row.address,
          }),
        `Approved pack ${shortPk(row.address)}`,
        { action: "approve", detail: `Season ${row.pack.seasonId}` },
      ),
    [signAndSend],
  );

  const onDisburse = useCallback(
    (row: Row) =>
      signAndSend(
        row.address,
        (cooperative) =>
          makeDisburseGrowPackIx({
            cooperative,
            farmer: row.pack.farmer,
            pack: row.address,
          }),
        `Disbursed pack ${shortPk(row.address)} — insurance now live`,
        { action: "disburse", detail: `Season ${row.pack.seasonId}` },
      ),
    [signAndSend],
  );

  const onTrigger = useCallback(
    (row: Row, rainfallPercent: number) =>
      signAndSend(
        row.address,
        (cooperative) =>
          makeTriggerInsurancePayoutIx({
            cooperative,
            farmer: row.pack.farmer,
            pack: row.address,
            rainfallPercent,
          }),
        `Triggered payout @ ${rainfallPercent}% rainfall`,
        { action: "trigger", detail: `${rainfallPercent}% rainfall` },
      ),
    [signAndSend],
  );

  const onSettle = useCallback(
    (row: Row, saleProceeds: bigint) =>
      signAndSend(
        row.address,
        (cooperative) =>
          makeSettleRepaymentIx({
            cooperative,
            farmer: row.pack.farmer,
            pack: row.address,
            saleProceeds,
          }),
        `Closed pack ${shortPk(row.address)} — repayment settled`,
        { action: "settle", detail: `Sale ${formatRand(saleProceeds)}` },
      ),
    [signAndSend],
  );

  const totalCount = rows.length;
  const pendingCount = buckets.pending.length;
  const approvedCount = buckets.approved.length;
  const activeCount = buckets.active.length;
  const harvestReadyCount = buckets.harvestReady.length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        color: "rgba(255, 245, 230, 0.92)",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient blobs — same brand tie-in as the dashboard */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-30%",
          background:
            "radial-gradient(circle at 18% 28%, #ff7b6b, transparent 32%), radial-gradient(circle at 78% 68%, #ffb86b, transparent 36%)",
          filter: "blur(140px)",
          opacity: 0.08,
          pointerEvents: "none",
        }}
      />

      <div className="coop-shell">
        {/* Header — single sticky row */}
        <header className="coop-header">
          <Link
            href="/"
            className="coop-home"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "rgba(255, 230, 210, 0.55)",
              textDecoration: "none",
              padding: "6px 10px 6px 6px",
              borderRadius: 999,
              border: "1px solid rgba(255, 230, 210, 0.12)",
              background: "rgba(255, 255, 255, 0.04)",
              whiteSpace: "nowrap",
            }}
          >
            <ArrowLeft size={14} />
            Home
          </Link>
          <img
            src="/brand/logo-mark.svg"
            alt="Mazra'at albaan"
            width={36}
            height={36}
            style={{
              borderRadius: 10,
              boxShadow: "0 6px 18px rgba(0, 0, 0, 0.35)",
              display: "block",
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(255, 230, 210, 0.5)",
                fontWeight: 700,
              }}
            >
              Cooperative · admin panel
            </div>
            <h1
              style={{
                margin: "2px 0 0",
                fontSize: 20,
                fontWeight: 800,
                color: "rgba(255, 245, 230, 0.95)",
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
              }}
            >
              Mazra&apos;at albaan — Co-op
            </h1>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loadState === "loading"}
            title="Refresh from devnet"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255, 230, 210, 0.14)",
              background: "rgba(255, 255, 255, 0.06)",
              color: "rgba(255, 245, 230, 0.92)",
              fontSize: 11,
              fontWeight: 700,
              cursor: loadState === "loading" ? "default" : "pointer",
              opacity: loadState === "loading" ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {loadState === "loading" ? (
              <Loader2 size={12} className="spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Refresh
          </button>
          <WalletButton />
        </header>

        {/* Status bar — chips left, signed-in pill right */}
        <div className="coop-statusbar">
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Chip label="Pending" count={pendingCount} tone="warn" />
            <Chip label="To disburse" count={approvedCount} tone="info" />
            <Chip label="Active" count={activeCount} tone="ok" />
            <Chip label="To close" count={harvestReadyCount} tone="info" />
            <Chip label="Total" count={totalCount} tone="muted" />
          </div>
          {publicKey ? (
            <div
              title={publicKey.toBase58()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 230, 210, 0.12)",
                fontSize: 11,
                color: "rgba(255, 230, 210, 0.72)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "#7adf7d",
                  boxShadow: "0 0 8px rgba(122, 223, 125, 0.7)",
                }}
              />
              <span
                style={{
                  fontFamily:
                    "var(--font-geist-mono), ui-monospace, monospace",
                  color: "#ffb86b",
                }}
              >
                {shortPk(publicKey.toBase58())}
              </span>
              <span>· devnet</span>
            </div>
          ) : null}
        </div>

        {/* Wallet-not-connected banner */}
        {!publicKey ? (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 12,
              borderLeft: "3px solid #ffb86b",
              background: "rgba(255, 184, 107, 0.06)",
              border: "1px solid rgba(255, 184, 107, 0.35)",
              fontSize: 12,
              color: "rgba(255, 230, 210, 0.78)",
              lineHeight: 1.5,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <ShieldCheck
              size={16}
              style={{ color: "#ffb86b", flexShrink: 0, marginTop: 1 }}
            />
            <div>
              <strong style={{ color: "rgba(255, 245, 230, 0.95)" }}>
                Connect a co-op wallet to take action.
              </strong>{" "}
              The wallet must equal the cooperative recorded on each
              FarmerAccount being acted on. For the demo, that&apos;s the
              keypair that ran <code>setup-devnet-demo.mjs</code>.
            </div>
          </div>
        ) : null}

        {/* Toast */}
        {toast ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 12,
              background:
                toast.kind === "ok"
                  ? "rgba(46, 125, 50, 0.18)"
                  : "rgba(192, 57, 43, 0.18)",
              border: `1px solid ${
                toast.kind === "ok"
                  ? "rgba(46, 125, 50, 0.55)"
                  : "rgba(192, 57, 43, 0.55)"
              }`,
              color: toast.kind === "ok" ? "#7adf7d" : "#ff9b8e",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {toast.kind === "ok" ? (
              <CheckCircle2 size={14} />
            ) : (
              <AlertCircle size={14} />
            )}
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
              {toast.text}
            </span>
            <button
              type="button"
              onClick={() => setToast(null)}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                color: "inherit",
                fontSize: 11,
                cursor: "pointer",
                opacity: 0.7,
              }}
            >
              dismiss
            </button>
          </div>
        ) : null}

        {/* Two-column admin grid: actions on the left, context on the right */}
        <div className="coop-grid">
          <main className="coop-main">
            <RegisterFarmerPanel
              cooperative={publicKey}
              connection={connection}
              sendTransaction={sendTransaction}
              onConnectClick={() => setWalletModalVisible(true)}
              recordAudit={audit.record}
            />

            {loadState === "loading" ? (
              <BlockMessage icon={<Loader2 className="spin" />}>
                Reading every Grow Pack from devnet…
              </BlockMessage>
            ) : loadState === "error" ? (
              <BlockMessage icon={<AlertCircle />} tone="warn">
                Couldn&apos;t reach the chain: {errorMsg}
              </BlockMessage>
            ) : (
              <>
                <Section
                  title="Pending applications"
                  subtitle="Newly requested Grow Packs awaiting your approval."
                  rows={buckets.pending}
                  emptyText="No pending applications. Ask a farmer to apply from the dashboard."
                  renderAction={(row) => (
                    <ActionButton
                      busy={busyAddress === row.address.toBase58()}
                      disabled={!publicKey}
                      onClick={() => onApprove(row)}
                      label="Approve"
                    />
                  )}
                />

                <Section
                  title="Awaiting disbursement"
                  subtitle="Approved packs — confirm inputs delivered to make insurance live."
                  rows={buckets.approved}
                  emptyText="Nothing here right now."
                  renderAction={(row) => (
                    <ActionButton
                      busy={busyAddress === row.address.toBase58()}
                      disabled={!publicKey}
                      onClick={() => onDisburse(row)}
                      label="Disburse"
                    />
                  )}
                />

                <Section
                  title="Active packs — drought watch"
                  subtitle="Insurance is live. Enter observed rainfall to trigger payout if the threshold is breached."
                  rows={buckets.active}
                  emptyText="No active packs to monitor."
                  renderAction={(row) => (
                    <TriggerControl
                      row={row}
                      busy={busyAddress === row.address.toBase58()}
                      disabled={!publicKey}
                      onTrigger={onTrigger}
                    />
                  )}
                />

                <Section
                  title="Harvest close"
                  subtitle="Active or post-drought packs that can be settled. Enter the sale proceeds — the program splits funds into repaid, surplus, and shortfall, then updates credit score."
                  rows={buckets.harvestReady}
                  emptyText="No packs ready for harvest close yet."
                  renderAction={(row) => (
                    <SettleControl
                      row={row}
                      busy={busyAddress === row.address.toBase58()}
                      disabled={!publicKey}
                      onSettle={onSettle}
                    />
                  )}
                />
              </>
            )}
          </main>

          <aside className="coop-aside">
            <FarmersPanel rows={rows} />
            <AuditLogPanel entries={audit.entries} onClear={audit.clear} />
          </aside>
        </div>
      </div>

      {/* Layout + spin keyframe — kept inline so /coop owns its admin grid
          without polluting the dashboard CSS module. */}
      <style jsx global>{`
        .coop-shell {
          position: relative;
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 24px 80px;
          z-index: 1;
        }
        .coop-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .coop-statusbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 230, 210, 0.08);
        }
        .coop-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 24px;
          align-items: start;
        }
        .coop-main {
          min-width: 0;
        }
        .coop-aside {
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: sticky;
          top: 16px;
        }
        @media (max-width: 980px) {
          .coop-shell { padding: 16px 16px 64px; }
          .coop-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          .coop-aside {
            position: static;
          }
        }
        @keyframes coop-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: coop-spin 0.9s linear infinite;
        }
      `}</style>
    </div>
  );
}

// ─── helper components ───────────────────────────────────────────────

function Chip({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "ok" | "warn" | "info" | "muted";
}) {
  const colors: Record<typeof tone, { bg: string; border: string; text: string }> = {
    ok: { bg: "rgba(46, 125, 50, 0.14)", border: "rgba(46, 125, 50, 0.45)", text: "#7adf7d" },
    warn: { bg: "rgba(255, 184, 107, 0.14)", border: "rgba(255, 184, 107, 0.45)", text: "#ffb86b" },
    info: { bg: "rgba(255, 123, 107, 0.14)", border: "rgba(255, 123, 107, 0.45)", text: "#ff9b8e" },
    muted: { bg: "rgba(255, 255, 255, 0.04)", border: "rgba(255, 230, 210, 0.14)", text: "rgba(255, 230, 210, 0.65)" },
  };
  const c = colors[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          padding: "1px 7px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.25)",
          fontWeight: 800,
        }}
      >
        {count}
      </span>
    </span>
  );
}

function BlockMessage({
  children,
  icon,
  tone = "muted",
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "muted" | "warn";
}) {
  return (
    <div
      className={dashStyles.box}
      style={{
        background: tone === "warn" ? "rgba(192, 57, 43, 0.10)" : undefined,
        borderColor: tone === "warn" ? "rgba(192, 57, 43, 0.45)" : undefined,
      }}
    >
      <div
        className={dashStyles.boxBody}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          textAlign: "center",
          justifyContent: "center",
          padding: 28,
          color: "rgba(255, 230, 210, 0.72)",
          fontSize: 13,
        }}
      >
        {icon}
        <span>{children}</span>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  rows,
  emptyText,
  renderAction,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  emptyText: string;
  renderAction: (row: Row) => React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 10 }}>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "rgba(255, 245, 230, 0.95)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255, 230, 210, 0.55)",
            marginTop: 2,
          }}
        >
          {subtitle}
        </div>
      </div>
      {rows.length === 0 ? (
        <div
          className={dashStyles.box}
          style={{ background: "rgba(255, 255, 255, 0.02)" }}
        >
          <div
            className={dashStyles.boxBody}
            style={{
              fontSize: 12,
              color: "rgba(255, 230, 210, 0.45)",
              textAlign: "center",
              padding: 18,
            }}
          >
            {emptyText}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <PackRow key={row.address.toBase58()} row={row} action={renderAction(row)} />
          ))}
        </div>
      )}
    </section>
  );
}

function PackRow({ row, action }: { row: Row; action: React.ReactNode }) {
  const { pack, address } = row;
  return (
    <div className={dashStyles.box}>
      <div
        className={dashStyles.boxBody}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <Sprout size={14} style={{ color: "#ffb86b", flexShrink: 0 }} />
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "rgba(255, 245, 230, 0.95)",
              }}
            >
              Season {pack.seasonId}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "2px 7px",
                borderRadius: 999,
                background: "rgba(255, 184, 107, 0.10)",
                color: "#ffb86b",
                border: "1px solid rgba(255, 184, 107, 0.35)",
              }}
            >
              {pack.status}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "2px 12px",
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              color: "rgba(255, 230, 210, 0.55)",
            }}
          >
            <span>pack</span>
            <span style={{ color: "rgba(255, 230, 210, 0.85)" }}>
              {shortPk(address)}
            </span>
            <span>farmer</span>
            <span style={{ color: "rgba(255, 230, 210, 0.85)" }}>
              {shortPk(pack.farmer)}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              marginTop: 8,
              color: "rgba(255, 230, 210, 0.72)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Bundle {formatRand(pack.bundleCost)} · Repay{" "}
            {formatRand(pack.totalRepayment)} · Threshold{" "}
            {pack.thresholdPercent}% · Max payout {formatRand(pack.maxPayout)}
            {pack.rainfallPercentOfNorm > 0 ? (
              <>
                {" "}· Rainfall observed{" "}
                <strong>{pack.rainfallPercentOfNorm}%</strong>
              </>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          {action}
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  busy,
  disabled,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 999,
        border: "1px solid rgba(255, 184, 107, 0.55)",
        background:
          busy || disabled
            ? "rgba(255, 184, 107, 0.10)"
            : "linear-gradient(135deg, #ff7b6b, #ffb86b)",
        color: busy || disabled ? "rgba(255, 245, 230, 0.55)" : "#1a0f0c",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        cursor: busy || disabled ? "default" : "pointer",
        boxShadow:
          busy || disabled
            ? "none"
            : "0 8px 18px rgba(255, 123, 107, 0.30)",
        whiteSpace: "nowrap",
      }}
    >
      {busy ? <Loader2 size={12} className="spin" /> : null}
      {label}
    </button>
  );
}

// Regions list mirrors the apply-tab so the on-chain region codes match
// what farmers select when they submit a Grow Pack request.
const REGISTRATION_REGIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Eastern Cape" },
  { value: 1, label: "KwaZulu-Natal" },
  { value: 2, label: "Limpopo" },
  { value: 3, label: "Mpumalanga" },
  { value: 4, label: "Free State" },
  { value: 5, label: "North West" },
  { value: 6, label: "Western Cape" },
  { value: 7, label: "Northern Cape" },
  { value: 8, label: "Gauteng" },
];

function RegisterFarmerPanel({
  cooperative,
  connection,
  sendTransaction,
  onConnectClick,
  recordAudit,
}: {
  cooperative: PublicKey | null;
  connection: import("@solana/web3.js").Connection;
  sendTransaction:
    | ((tx: Transaction, conn: import("@solana/web3.js").Connection) => Promise<string>)
    | undefined;
  onConnectClick: () => void;
  recordAudit: (entry: Omit<AuditEntry, "id" | "ts">) => void;
}) {
  const [farmerInput, setFarmerInput] = useState("");
  const [region, setRegion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    setOkMsg(null);

    if (!cooperative || !sendTransaction) {
      onConnectClick();
      return;
    }
    let farmerPubkey: PublicKey;
    try {
      farmerPubkey = new PublicKey(farmerInput.trim());
    } catch {
      setError("That's not a valid Solana public key.");
      return;
    }
    setBusy(true);
    const operator = cooperative.toBase58();
    const target = farmerPubkey.toBase58();
    const regionLabel = REGISTRATION_REGIONS[region].label;
    try {
      const farmerIdHash = await farmerIdHashFrom(farmerPubkey.toBase58());
      const ix = makeRegisterFarmerIx({
        cooperative,
        farmerIdHash,
        region,
      });
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setOkMsg(
        `Registered ${shortPk(farmerPubkey)} in ${regionLabel} · tx ${shortPk(sig)}`,
      );
      recordAudit({
        action: "register",
        status: "ok",
        target,
        detail: regionLabel,
        signature: sig,
        operator,
      });
      setFarmerInput("");
    } catch (e) {
      let msg = e instanceof Error ? e.message : String(e);
      const cause = (e as { error?: unknown }).error;
      if (cause) {
        const logs = (cause as { logs?: string[] }).logs;
        if (Array.isArray(logs) && logs.length) {
          const programErr =
            logs.find((l) => /Program log:.*Error/i.test(l)) ??
            logs[logs.length - 1];
          msg = `${msg}\n${programErr}`;
        }
      }
      setError(msg);
      recordAudit({
        action: "register",
        status: "error",
        target,
        detail: regionLabel,
        errorMessage: msg,
        operator,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        marginBottom: 24,
        padding: 16,
        borderRadius: 14,
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 230, 210, 0.14)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <UserPlus size={14} style={{ color: "#ffb86b" }} />
        <h3
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "rgba(255, 245, 230, 0.95)",
            margin: 0,
          }}
        >
          Register a farmer
        </h3>
      </div>
      <p
        style={{
          fontSize: 11,
          color: "rgba(255, 230, 210, 0.55)",
          margin: "0 0 12px",
          lineHeight: 1.5,
        }}
      >
        Creates a FarmerAccount PDA seeded by the farmer&apos;s wallet pubkey
        and your cooperative wallet. The farmer can then apply for a Grow
        Pack from their dashboard.
      </p>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <label style={{ flex: "2 1 280px", minWidth: 240 }}>
          <span
            style={{
              display: "block",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(255, 230, 210, 0.55)",
              marginBottom: 4,
            }}
          >
            Farmer wallet
          </span>
          <input
            type="text"
            value={farmerInput}
            onChange={(e) => setFarmerInput(e.target.value)}
            placeholder="Paste the farmer's Solana public key"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255, 230, 210, 0.18)",
              background: "rgba(0, 0, 0, 0.28)",
              color: "rgba(255, 245, 230, 0.95)",
              fontSize: 12,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              outline: "none",
            }}
          />
        </label>
        <label style={{ flex: "1 1 140px", minWidth: 140 }}>
          <span
            style={{
              display: "block",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(255, 230, 210, 0.55)",
              marginBottom: 4,
            }}
          >
            Region
          </span>
          <select
            value={region}
            onChange={(e) => setRegion(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255, 230, 210, 0.18)",
              background: "rgba(0, 0, 0, 0.28)",
              color: "rgba(255, 245, 230, 0.95)",
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
            }}
          >
            {REGISTRATION_REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <ActionButton
          label={cooperative ? "Register" : "Connect wallet"}
          busy={busy}
          disabled={!farmerInput.trim() && Boolean(cooperative)}
          onClick={handleRegister}
        />
      </div>
      {error ? (
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(255, 123, 107, 0.10)",
            border: "1px solid rgba(255, 123, 107, 0.35)",
            fontSize: 11,
            color: "#ffb0a3",
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      ) : null}
      {okMsg ? (
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(46, 125, 50, 0.10)",
            border: "1px solid rgba(46, 125, 50, 0.35)",
            fontSize: 11,
            color: "#7adf7d",
          }}
        >
          {okMsg}
        </div>
      ) : null}
    </div>
  );
}

function SettleControl({
  row,
  busy,
  disabled,
  onSettle,
}: {
  row: Row;
  busy: boolean;
  disabled: boolean;
  onSettle: (row: Row, saleProceeds: bigint) => void;
}) {
  // Pre-populate with the total repayment amount — the most common case is
  // the farmer sold for exactly the loan amount. Operator edits up/down to
  // reflect actual sale.
  const [proceeds, setProceeds] = useState<string>(
    () => row.pack.totalRepayment.toString(),
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          color: "rgba(255, 230, 210, 0.65)",
        }}
      >
        Sale R
        <input
          type="number"
          min={0}
          value={proceeds}
          onChange={(e) => setProceeds(e.target.value)}
          style={{
            width: 80,
            marginLeft: 4,
            padding: "4px 6px",
            borderRadius: 8,
            border: "1px solid rgba(255, 230, 210, 0.18)",
            background: "rgba(0, 0, 0, 0.25)",
            color: "rgba(255, 245, 230, 0.95)",
            fontSize: 12,
            fontFamily: "inherit",
            fontVariantNumeric: "tabular-nums",
          }}
        />
      </label>
      <ActionButton
        label="Close"
        busy={busy}
        disabled={disabled}
        onClick={() => {
          let n: bigint;
          try {
            n = BigInt(proceeds.trim() || "0");
          } catch {
            return;
          }
          if (n < 0n) return;
          onSettle(row, n);
        }}
      />
    </div>
  );
}

function TriggerControl({
  row,
  busy,
  disabled,
  onTrigger,
}: {
  row: Row;
  busy: boolean;
  disabled: boolean;
  onTrigger: (row: Row, rainfallPercent: number) => void;
}) {
  // Default to 40% — tier-3 rainfall in the proposal numbers, fires
  // the 80%-of-cover payout. Lets a co-op officer one-click the demo.
  const [rainfall, setRainfall] = useState(40);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          color: "rgba(255, 230, 210, 0.65)",
        }}
      >
        <Droplets size={12} />
        Rainfall %
        <input
          type="number"
          min={0}
          max={255}
          value={rainfall}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) setRainfall(Math.max(0, Math.min(255, n)));
          }}
          style={{
            width: 56,
            marginLeft: 4,
            padding: "4px 6px",
            borderRadius: 8,
            border: "1px solid rgba(255, 230, 210, 0.18)",
            background: "rgba(0, 0, 0, 0.25)",
            color: "rgba(255, 245, 230, 0.95)",
            fontSize: 12,
            fontFamily: "inherit",
            fontVariantNumeric: "tabular-nums",
          }}
        />
      </label>
      <ActionButton
        label="Trigger"
        busy={busy}
        disabled={disabled}
        onClick={() => onTrigger(row, rainfall)}
      />
    </div>
  );
}

// ─── audit log panel ─────────────────────────────────────────────────

const ACTION_META: Record<
  AuditAction,
  { label: string; verb: string; tint: string }
> = {
  approve: { label: "Approve", verb: "approved", tint: "#7adf7d" },
  disburse: { label: "Disburse", verb: "disbursed", tint: "#ffb86b" },
  trigger: { label: "Payout", verb: "triggered payout for", tint: "#ff9b8e" },
  settle: { label: "Settle", verb: "closed", tint: "#7adf7d" },
  register: { label: "Register", verb: "registered farmer", tint: "#ffb86b" },
};

function formatRelativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function CopyButton({ value, title }: { value: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={title ?? "Copy"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          // Clipboard blocked; silent — the value is still visible.
        }
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 7px",
        borderRadius: 999,
        border: "1px solid rgba(255, 230, 210, 0.16)",
        background: copied ? "rgba(46, 125, 50, 0.18)" : "rgba(255, 255, 255, 0.04)",
        color: copied ? "#7adf7d" : "rgba(255, 230, 210, 0.72)",
        fontSize: 10,
        fontWeight: 700,
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function AuditLogPanel({
  entries,
  onClear,
}: {
  entries: AuditEntry[];
  onClear: () => void;
}) {
  // Re-render every 30s so "2m ago" stays roughly current — cheaper than
  // a per-row timer.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 230, 210, 0.14)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <History size={14} style={{ color: "#ffb86b" }} />
        <h3
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "rgba(255, 245, 230, 0.95)",
            margin: 0,
          }}
        >
          Recent activity
        </h3>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            padding: "2px 7px",
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.06)",
            color: "rgba(255, 230, 210, 0.65)",
          }}
        >
          {entries.length}
        </span>
        {entries.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            title="Clear local audit log"
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: "none",
              color: "rgba(255, 230, 210, 0.5)",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              padding: "2px 4px",
            }}
          >
            <Trash2 size={10} />
            Clear
          </button>
        ) : null}
      </div>
      <p
        style={{
          fontSize: 11,
          color: "rgba(255, 230, 210, 0.55)",
          margin: "0 0 12px",
          lineHeight: 1.5,
        }}
      >
        Every action this browser takes through /coop, persisted locally so
        you can spot what changed since you last looked.
      </p>
      {entries.length === 0 ? (
        <div
          style={{
            padding: "18px 8px",
            textAlign: "center",
            fontSize: 11,
            color: "rgba(255, 230, 210, 0.45)",
            border: "1px dashed rgba(255, 230, 210, 0.12)",
            borderRadius: 10,
          }}
        >
          No actions recorded yet on this device.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {entries.map((e) => {
            const meta = ACTION_META[e.action];
            const isOk = e.status === "ok";
            return (
              <li
                key={e.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(255, 230, 210, 0.10)",
                  background: isOk
                    ? "rgba(255, 255, 255, 0.025)"
                    : "rgba(192, 57, 43, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      padding: "2px 7px",
                      borderRadius: 999,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      background: `${meta.tint}22`,
                      color: meta.tint,
                      border: `1px solid ${meta.tint}55`,
                    }}
                  >
                    {meta.label}
                  </span>
                  <span
                    style={{
                      fontFamily:
                        "var(--font-geist-mono), ui-monospace, monospace",
                      color: "rgba(255, 245, 230, 0.85)",
                    }}
                  >
                    {shortPk(e.target)}
                  </span>
                  {e.detail ? (
                    <span style={{ color: "rgba(255, 230, 210, 0.55)" }}>
                      · {e.detail}
                    </span>
                  ) : null}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      color: "rgba(255, 230, 210, 0.45)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatRelativeTime(e.ts, now)}
                  </span>
                </div>
                {isOk && e.signature ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 10,
                      color: "rgba(255, 230, 210, 0.5)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily:
                          "var(--font-geist-mono), ui-monospace, monospace",
                      }}
                    >
                      tx {shortPk(e.signature)}
                    </span>
                    <a
                      href={`https://explorer.solana.com/tx/${e.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer noopener"
                      title="Open on Solana Explorer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        color: "rgba(255, 184, 107, 0.85)",
                        textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={9} />
                      Explorer
                    </a>
                  </div>
                ) : null}
                {!isOk && e.errorMessage ? (
                  <div
                    style={{
                      fontSize: 10,
                      color: "#ff9b8e",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {e.errorMessage.split("\n").slice(0, 2).join(" — ")}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── farmers / demo personas panel ───────────────────────────────────
//
// Auto-derived from the GrowPacks already on chain. Gives the demo
// operator a quick "who's on devnet right now" panel with copy-pubkey
// buttons so they can paste an address into the Register Farmer form,
// Phantom, or share with a buyer for the marketplace demo.

type FarmerSummary = {
  farmer: PublicKey;
  packCount: number;
  latestSeasonId: number;
  latestStatus: string;
};

function summariseFarmers(rows: Row[]): FarmerSummary[] {
  const byFarmer = new Map<string, FarmerSummary>();
  for (const r of rows) {
    const key = r.pack.farmer.toBase58();
    const existing = byFarmer.get(key);
    if (!existing) {
      byFarmer.set(key, {
        farmer: r.pack.farmer,
        packCount: 1,
        latestSeasonId: r.pack.seasonId,
        latestStatus: r.pack.status,
      });
    } else {
      existing.packCount += 1;
      if (r.pack.seasonId > existing.latestSeasonId) {
        existing.latestSeasonId = r.pack.seasonId;
        existing.latestStatus = r.pack.status;
      }
    }
  }
  return Array.from(byFarmer.values()).sort(
    (a, b) =>
      b.latestSeasonId - a.latestSeasonId ||
      a.farmer.toBase58().localeCompare(b.farmer.toBase58()),
  );
}

function FarmersPanel({ rows }: { rows: Row[] }) {
  const farmers = useMemo(() => summariseFarmers(rows), [rows]);
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 230, 210, 0.14)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <Users size={14} style={{ color: "#ffb86b" }} />
        <h3
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "rgba(255, 245, 230, 0.95)",
            margin: 0,
          }}
        >
          Farmers on devnet
        </h3>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            padding: "2px 7px",
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.06)",
            color: "rgba(255, 230, 210, 0.65)",
          }}
        >
          {farmers.length}
        </span>
      </div>
      <p
        style={{
          fontSize: 11,
          color: "rgba(255, 230, 210, 0.55)",
          margin: "0 0 12px",
          lineHeight: 1.5,
        }}
      >
        Every farmer with at least one pack on chain. Copy an address to
        paste into Phantom, the Register form, or share with a buyer for the
        marketplace demo.
      </p>
      {farmers.length === 0 ? (
        <div
          style={{
            padding: "18px 8px",
            textAlign: "center",
            fontSize: 11,
            color: "rgba(255, 230, 210, 0.45)",
            border: "1px dashed rgba(255, 230, 210, 0.12)",
            borderRadius: 10,
          }}
        >
          No farmers yet. Run <code>setup-devnet-demo.mjs</code> or use
          Register above.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {farmers.map((f) => {
            const pk = f.farmer.toBase58();
            return (
              <li
                key={pk}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(255, 230, 210, 0.10)",
                  background: "rgba(255, 255, 255, 0.025)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily:
                        "var(--font-geist-mono), ui-monospace, monospace",
                      color: "rgba(255, 245, 230, 0.92)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={pk}
                  >
                    {shortPk(pk)}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255, 230, 210, 0.55)",
                      marginTop: 2,
                    }}
                  >
                    {f.packCount} pack{f.packCount === 1 ? "" : "s"} · latest
                    season {f.latestSeasonId} · {f.latestStatus}
                  </div>
                </div>
                <CopyButton value={pk} title="Copy farmer pubkey" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
