"use client";

// <MarketplaceTab /> — direct buyer ↔ farmer marketplace.
//
// This surface intentionally shows ONLY real on-chain data:
//
//   1. Active deals — Phase 2 escrow PDAs (Deal accounts) where the
//      connected wallet is either buyer or farmer. The farmer side
//      sees a Confirm-delivery button that signs `confirm_and_release`
//      and pulls the locked lamports.
//   2. Your pending harvests — the connected farmer's Grow Packs read
//      from devnet, filtered to harvest-still-coming statuses
//      (Requested / Approved / Active).
//
// The earlier hardcoded "Buyers looking now" section was removed by
// request — buyer offers will return as on-chain `BuyerOffer` PDAs in
// Phase 3, posted by real partner buyers (mills, retailers, brewers).
// Until then this surface is honest about what's real.
//
// Hide-the-chain rule (CLAUDE.md §7) — Rand and harvest dates only in
// farmer-facing copy. The Phase 2 confirm flow shows lamports because
// it's the developer-facing demo surface.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  fetchDeal,
  makeConfirmAndReleaseIx,
  farmerIdHashFrom,
  farmerPda,
  packPda,
  fetchGrowPack,
  type Deal,
  type GrowPack,
} from "@/lib/vuna/program";
import {
  readDemoDeals,
  removeDemoDeal,
  type DemoDeal,
} from "@/lib/vuna/demo-deals";
import styles from "./dashboard.module.css";

const ZAR = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });

// ============================================================================
//  Tab body
// ============================================================================

type ActiveDeal = {
  cached: DemoDeal;
  /** Truthy if PDA still on-chain; null after release. */
  onChain: Deal | null;
};

export function MarketplaceTab() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [deals, setDeals] = useState<ActiveDeal[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load deals from localStorage and check each one against the chain.
  // Re-runs on wallet change or after a successful release.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = readDemoDeals();
      const enriched = await Promise.all(
        cached.map(async (d) => {
          try {
            const onChain = await fetchDeal(connection, new PublicKey(d.pda));
            return { cached: d, onChain };
          } catch {
            return { cached: d, onChain: null };
          }
        }),
      );
      if (!cancelled) setDeals(enriched);
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, publicKey, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Filter to deals where this wallet is buyer or farmer. Released
  // deals (PDA closed on-chain) still surface so users can see history.
  const myDeals = useMemo(() => {
    if (!publicKey) return [];
    const me = publicKey.toBase58();
    return deals.filter(
      ({ cached }) => cached.buyer === me || cached.farmer === me,
    );
  }, [deals, publicKey]);

  // Farmer side — sign confirm_and_release. Returns the tx signature.
  const handleConfirmDeal = useCallback(
    async (active: ActiveDeal) => {
      if (!publicKey || !sendTransaction) {
        throw new Error("Connect a wallet first.");
      }
      const ix = makeConfirmAndReleaseIx({
        deal: new PublicKey(active.cached.pda),
        farmer: publicKey,
      });
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      // PDA is now closed on-chain — drop from the local list.
      removeDemoDeal(active.cached.pda);
      refresh();
      return sig;
    },
    [publicKey, sendTransaction, connection, refresh],
  );

  return (
    <div className={styles.timelineSingle}>
      {/* Pitch / explainer card */}
      <div
        className={`${styles.box} ${styles.session}`}
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 184, 107, 0.16), rgba(255, 123, 107, 0.08))",
          border: "1px solid rgba(255, 184, 107, 0.4)",
        }}
      >
        <div className={styles.sessionEyebrow}>
          <span className={styles.sessionDot} />
          Direct buyers — no middlemen
        </div>
        <h3 className={styles.sessionTitle}>Skip the middleman.</h3>
        <p className={styles.sessionSubtitle}>
          Mills, retailers and brewers will buy your harvest directly here,
          paying around 25&#37; more than the local middleman. Buyer offers
          arrive on-chain in Phase 3 — for now this surface shows only the
          parts that are real today: your pending harvests, and any
          escrow deals you&apos;re a party to.
        </p>
      </div>

      {/* Active deals — only when this wallet is in any */}
      {publicKey && myDeals.length > 0 ? (
        <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 4px",
            }}
          >
            <ShieldCheck size={12} style={{ color: "#7adf7d" }} />
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255, 230, 210, 0.55)",
                fontWeight: 700,
              }}
            >
              Active deals (live on devnet)
            </span>
          </div>
          {myDeals.map((d) => (
            <ActiveDealCard
              key={d.cached.pda}
              active={d}
              myWallet={publicKey.toBase58()}
              onConfirm={() => handleConfirmDeal(d)}
            />
          ))}
        </div>
      ) : null}

      {/* Pending harvests */}
      <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 4px",
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255, 230, 210, 0.55)",
              fontWeight: 700,
            }}
          >
            Your pending harvests
          </span>
        </div>
        <FarmerHarvests />
      </div>

      {/* Footer */}
      <div
        style={{
          fontSize: 10,
          color: "rgba(255, 230, 210, 0.4)",
          padding: "4px 6px",
          textAlign: "center",
          letterSpacing: "0.04em",
          lineHeight: 1.55,
        }}
      >
        Pending harvests above read your real on-chain Grow Packs. Phase 3
        will add on-chain buyer offers from partner mills, retailers, and
        brewers.
      </div>
    </div>
  );
}

// ============================================================================
//  Farmer harvests — derived from the connected farmer's on-chain Grow Packs
// ============================================================================
//
// "Your pending harvests" reads the connected wallet's Grow Packs across
// the last 3 seasons (same lookback as the History tab) and shows the ones
// with status Requested / Approved / Active — packs whose harvest is still
// ahead and so could be matched by a buyer offer.
//
// Settled packs (Repaid / InsurancePaid / Defaulted) are intentionally
// hidden here — those harvests are no longer available for sale.

const HARVEST_LOOKBACK_SEASONS = 3;

type HarvestRow = {
  season: number;
  packAddress: string;
  pack: GrowPack;
};

function FarmerHarvests() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [rows, setRows] = useState<HarvestRow[]>([]);
  const [state, setState] = useState<
    "loading" | "ready" | "no-wallet" | "empty" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState("");

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
        const farmerIdHash = await farmerIdHashFrom(publicKey.toBase58());
        const [farmerAcc] = farmerPda(publicKey, farmerIdHash);
        const currentYear = new Date().getFullYear();
        const seasons = Array.from(
          { length: HARVEST_LOOKBACK_SEASONS },
          (_, i) => currentYear - i,
        );
        const fetched = await Promise.all(
          seasons.map(async (season) => {
            const [packAcc] = packPda(farmerAcc, season);
            const data = await fetchGrowPack(connection, packAcc);
            return { season, packAddress: packAcc.toBase58(), data };
          }),
        );
        if (cancelled) return;
        const matchable: HarvestRow[] = fetched
          .filter(
            (r): r is { season: number; packAddress: string; data: GrowPack } =>
              r.data !== null,
          )
          .filter(
            ({ data }) =>
              data.status === "Approved" ||
              data.status === "Active" ||
              data.status === "Requested",
          )
          .map(({ season, packAddress, data }) => ({
            season,
            packAddress,
            pack: data,
          }));
        setRows(matchable);
        setState(matchable.length > 0 ? "ready" : "empty");
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection]);

  if (state === "no-wallet") {
    return (
      <div className={styles.box}>
        <div className={styles.boxBody}>
          <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.72)" }}>
            Connect your wallet to see harvests you can list for direct buyers.
          </span>
        </div>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className={styles.box}>
        <div
          className={styles.boxBody}
          style={{ textAlign: "center", padding: 24 }}
        >
          <span style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.55)" }}>
            Reading your Grow Packs from devnet…
          </span>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={styles.box}>
        <div className={styles.boxBody}>
          <span style={{ fontSize: 12, color: "#ffb0a3" }}>
            Couldn&apos;t reach the chain — {errorMsg}
          </span>
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className={styles.box}>
        <div className={styles.boxBody}>
          <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.72)" }}>
            No pending harvests yet. Open the <strong>Apply</strong> tab to
            request a Grow Pack — once approved, this is where it shows up.
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <HarvestCard key={row.packAddress} row={row} />
      ))}
    </>
  );
}

function HarvestCard({ row }: { row: HarvestRow }) {
  const { season, packAddress, pack } = row;
  const totalRepayment = Number(pack.totalRepayment);
  const bundleCost = Number(pack.bundleCost);

  const statusColor =
    pack.status === "Active"
      ? "#7adf7d"
      : pack.status === "Approved"
      ? "#ffb86b"
      : "rgba(255, 230, 210, 0.55)";

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
              Pending harvest · Season {season}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 11,
                color: "rgba(255, 230, 210, 0.55)",
              }}
            >
              <span
                style={{
                  fontFamily:
                    "var(--font-geist-mono), ui-monospace, monospace",
                }}
              >
                {shortAddr(packAddress)}
              </span>
              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <CalendarDays size={10} /> harvest {season}
              </span>
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
            {pack.status}
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
            R {ZAR.format(bundleCost)} bundle
          </span>
          <span
            style={{
              fontSize: 11,
              color: "rgba(255, 230, 210, 0.55)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            · repay R {ZAR.format(totalRepayment)} at harvest
          </span>
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "rgba(255, 230, 210, 0.55)",
            lineHeight: 1.5,
          }}
        >
          A buyer who matches this harvest pays direct, settling at harvest
          and clearing your loan automatically.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
//  Active deal card — shown once a Phase 2 deal PDA is locked
// ============================================================================

type ConfirmState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "error"; message: string };

function ActiveDealCard({
  active,
  myWallet,
  onConfirm,
}: {
  active: ActiveDeal;
  myWallet: string;
  onConfirm: () => Promise<string>;
}) {
  const { cached, onChain } = active;
  const isBuyer = cached.buyer === myWallet;
  const isFarmer = cached.farmer === myWallet;
  const released = onChain === null;

  const [confirmState, setConfirmState] = useState<ConfirmState>({ kind: "idle" });

  const lamports = onChain
    ? Number(onChain.amountLamports)
    : Number(BigInt(cached.amountLamports));
  const sol = lamports / LAMPORTS_PER_SOL;

  const handleConfirm = async () => {
    setConfirmState({ kind: "busy" });
    try {
      await onConfirm();
      // Card unmounts shortly after as parent refreshes the list.
    } catch (e) {
      setConfirmState({
        kind: "error",
        message: e instanceof Error ? e.message : "Transaction failed.",
      });
    }
  };

  const statusLabel = released
    ? "Released"
    : isFarmer
    ? "Awaiting your confirmation"
    : "Awaiting farmer";
  const statusColor = released ? "#7adf7d" : "#ffb86b";

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
              <div>buyer  {shortAddr(cached.buyer)}</div>
              <div>farmer {shortAddr(cached.farmer)}</div>
              <div>deal   {shortAddr(cached.pda)}</div>
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
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "rgba(255, 245, 230, 0.95)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ≈ R {Math.round(sol * 1000)} locked
          </span>
          <span
            style={{
              fontSize: 11,
              color: "rgba(255, 230, 210, 0.45)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ({sol.toFixed(3)} SOL)
          </span>
        </div>

        {released ? (
          <div
            style={{
              fontSize: 11,
              color: "rgba(255, 230, 210, 0.72)",
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(46, 125, 50, 0.10)",
              border: "1px solid rgba(46, 125, 50, 0.35)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CheckCircle2 size={12} style={{ color: "#7adf7d" }} />
            Funds delivered to farmer wallet.
          </div>
        ) : isFarmer ? (
          <>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirmState.kind === "busy"}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(122, 223, 125, 0.5)",
                background: "rgba(122, 223, 125, 0.12)",
                color: "#7adf7d",
                fontSize: 11,
                fontWeight: 800,
                fontFamily: "inherit",
                cursor: confirmState.kind === "busy" ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                opacity: confirmState.kind === "busy" ? 0.7 : 1,
              }}
            >
              {confirmState.kind === "busy" ? (
                <>
                  <Loader2
                    size={11}
                    style={{ animation: "vuna-spin 0.8s linear infinite" }}
                  />
                  Confirming…
                </>
              ) : (
                <>
                  <CheckCircle2 size={11} />
                  Confirm delivery → release funds
                </>
              )}
              <style jsx>{`
                @keyframes vuna-spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </button>
            {confirmState.kind === "error" ? (
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: "rgba(255, 123, 107, 0.10)",
                  border: "1px solid rgba(255, 123, 107, 0.35)",
                  fontSize: 10,
                  color: "#ffb0a3",
                }}
              >
                {confirmState.message}
              </div>
            ) : null}
          </>
        ) : isBuyer ? (
          <span
            style={{
              fontSize: 11,
              color: "rgba(255, 230, 210, 0.55)",
            }}
          >
            Switch to the farmer wallet in Phantom to confirm delivery.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
