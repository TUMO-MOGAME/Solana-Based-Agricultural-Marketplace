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
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  fetchAllGrowPacks,
  makeApproveGrowPackIx,
  makeDisburseGrowPackIx,
  makeTriggerInsurancePayoutIx,
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

// ─── page ────────────────────────────────────────────────────────────

export default function CoopPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connecting } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

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

  // Group by status — simple O(n) scan, three buckets.
  const buckets = useMemo(() => {
    const pending: Row[] = [];
    const approved: Row[] = [];
    const active: Row[] = [];
    for (const r of rows) {
      if (r.pack.status === "Requested") pending.push(r);
      else if (r.pack.status === "Approved") approved.push(r);
      else if (r.pack.status === "Active") active.push(r);
    }
    return { pending, approved, active };
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
    ) => {
      if (!publicKey || !sendTransaction) {
        setWalletModalVisible(true);
        return;
      }
      setBusyAddress(address.toBase58());
      setToast(null);
      try {
        const tx = new Transaction().add(buildIx(publicKey));
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
        setToast({ kind: "ok", text: `${okText} — ${shortPk(sig)}` });
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
      } finally {
        setBusyAddress(null);
      }
    },
    [publicKey, sendTransaction, connection, setWalletModalVisible, refresh],
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
      ),
    [signAndSend],
  );

  const totalCount = rows.length;
  const pendingCount = buckets.pending.length;
  const approvedCount = buckets.approved.length;
  const activeCount = buckets.active.length;

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

      <div
        style={{
          position: "relative",
          maxWidth: 980,
          margin: "0 auto",
          padding: "32px 24px 80px",
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
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
            }}
          >
            <ArrowLeft size={14} />
            Home
          </Link>
          <img
            src="/brand/logo-mark.svg"
            alt="Mazra'at albaan"
            width={40}
            height={40}
            style={{
              borderRadius: 12,
              boxShadow: "0 8px 20px rgba(0, 0, 0, 0.35)",
              display: "block",
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(255, 230, 210, 0.55)",
                fontWeight: 700,
              }}
            >
              Cooperative · admin panel
            </div>
            <h1
              style={{
                margin: "4px 0 0",
                fontSize: 26,
                fontWeight: 800,
                color: "rgba(255, 245, 230, 0.95)",
                lineHeight: 1.15,
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
        </div>

        {/* Wallet hint when not connected */}
        {!publicKey ? (
          <div
            className={dashStyles.box}
            style={{
              marginBottom: 24,
              borderColor: "rgba(255, 184, 107, 0.45)",
              background: "rgba(255, 184, 107, 0.06)",
            }}
          >
            <div className={dashStyles.boxBody}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(255, 245, 230, 0.95)",
                }}
              >
                <ShieldCheck size={18} style={{ color: "#ffb86b" }} />
                Connect a co-op wallet to take action.
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255, 230, 210, 0.65)",
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                The wallet you connect must equal the cooperative recorded on
                each FarmerAccount being acted on (the on-chain program enforces
                this with{" "}
                <code style={{ fontSize: 11 }}>has_one = cooperative</code>).
                For the demo, that&apos;s your default Solana CLI keypair —
                whichever wallet originally ran <code>setup-devnet-demo.mjs</code>.
              </div>
            </div>
          </div>
        ) : (
          // Connected — show the pubkey + a network reminder. The most
          // common failure on first run is Phantom being on mainnet
          // instead of devnet; surface that prominently.
          <div
            style={{
              marginBottom: 24,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 230, 210, 0.12)",
              fontSize: 12,
              color: "rgba(255, 230, 210, 0.72)",
              lineHeight: 1.5,
            }}
          >
            Signed in as{" "}
            <code
              style={{
                fontSize: 11,
                fontFamily:
                  "var(--font-geist-mono), ui-monospace, monospace",
                color: "#ffb86b",
              }}
            >
              {publicKey.toBase58()}
            </code>
            <span style={{ display: "block", marginTop: 4 }}>
              Make sure Phantom is set to <strong>Devnet</strong> (Phantom
              menu → Settings → Developer settings → Change network → Devnet).
              If a tx fails with &quot;Unexpected error&quot;, it&apos;s
              usually that, or your wallet isn&apos;t the cooperative on the
              farmer record.
            </span>
          </div>
        )}

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
              color:
                toast.kind === "ok" ? "#7adf7d" : "#ff9b8e",
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

        {/* Summary chips */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <Chip label="Pending" count={pendingCount} tone="warn" />
          <Chip label="Awaiting disbursement" count={approvedCount} tone="info" />
          <Chip label="Active" count={activeCount} tone="ok" />
          <Chip label="All packs on devnet" count={totalCount} tone="muted" />
        </div>

        {/* Load states */}
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
          </>
        )}
      </div>

      {/* spin keyframe — used by the Loader2 icons above */}
      <style jsx global>{`
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
