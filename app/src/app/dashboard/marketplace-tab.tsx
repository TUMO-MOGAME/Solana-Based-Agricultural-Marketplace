"use client";

// <MarketplaceTab /> — direct buyer ↔ farmer produce marketplace.
//
// Phase 1 (the listings UI): mock buyer offers + farmer listings,
// surfacing the "+ X% vs middleman" pitch from CLAUDE.md §3. The
// numbers are illustrative SAGIS/DAFF spot averages.
//
// Phase 2 (the on-chain escrow): the **Match buyer** modal now signs
// a real `create_deal` transaction that locks lamports into a Deal
// PDA on devnet. The receiving farmer wallet then signs
// `confirm_and_release` to close the PDA and pull the lamports.
// The amount is 0.01 SOL displayed as "≈ R 10" — devnet has no real
// stablecoin, so we use lamports as a stand-in.
//
// Demo flow:
//   1. Connect as the BUYER wallet, click Match buyer, paste your
//      other wallet's address as farmer, sign → SOL locked on-chain.
//   2. Switch wallets to FARMER in Phantom — the dashboard reconnects
//      and the deal shows up under "Active deals".
//   3. Click "Confirm delivery" → sign → SOL flows to FARMER.
//
// In production, the cooperative — not the farmer — confirms delivery,
// and the locked unit is a ZAR-stablecoin not SOL. The simplifications
// are documented in the on-chain instruction handlers and on the
// PDF-presentation Phase 2 page.
//
// Hide-the-chain rule (CLAUDE.md §7) — Rand and harvest dates in the
// pitch UI. The Phase 2 demo section says "≈ R 10" but reveals that
// it's lamports for the demo, since this is a developer-facing flow,
// not the farmer-facing surface.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sprout,
  MapPin,
  CalendarDays,
  ArrowRight,
  Store,
  TrendingUp,
  X,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  dealPda,
  fetchDeal,
  makeCreateDealIx,
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
  addDemoDeal,
  removeDemoDeal,
  randomDealId,
  type DemoDeal,
} from "@/lib/vuna/demo-deals";
import styles from "./dashboard.module.css";

// 0.01 SOL is what the demo locks per match. Displayed as "≈ R 10" —
// Rand-pegged stablecoins live on a different chain or aren't on
// devnet, so we use lamports as a realistic stand-in.
const DEMO_LAMPORTS = BigInt(Math.round(0.01 * LAMPORTS_PER_SOL));
const DEMO_RAND_LABEL = "R 10";

type Crop = "Maize" | "Wheat" | "Soybean" | "Sorghum" | "Beans";

type BuyerOffer = {
  id: string;
  buyer: string;
  buyerType: "Mill" | "Retailer" | "Co-op" | "Brewer" | "Exporter";
  crop: Crop;
  region: string;
  maxQuantityTons: number;
  pricePerTonZAR: number;
  /** What the local middleman typically pays for this crop, R/ton.
   *  We surface (pricePerTonZAR - middlemanPriceZAR) as the headline
   *  "your savings" number. Real-world numbers ballpark from SAGIS
   *  + DAFF spot prices for SA smallholders, 2024–2025 averages. */
  middlemanPriceZAR: number;
  byMonth: string;
};

// ─── Indicative buyer offers ──────────────────────────────────────────
//
// These represent the kind of partner buyers (mills, retailers,
// brewers, co-ops) we'll onboard for the H1 2027 pilot. Pricing
// reflects SAGIS / DAFF spot averages from late 2024 / early 2025.
//
// In Phase 3 these will be replaced by `BuyerOffer` PDAs that real
// buyers post on-chain. The Match modal already creates real on-chain
// Deal PDAs from these rows — only the *offer source* is curated.
const BUYER_OFFERS: BuyerOffer[] = [
  {
    id: "lebone-maize-ec",
    buyer: "Lebone Mills",
    buyerType: "Mill",
    crop: "Maize",
    region: "Eastern Cape",
    maxQuantityTons: 50,
    pricePerTonZAR: 5400,
    middlemanPriceZAR: 4200,
    byMonth: "Oct 2026",
  },
  {
    id: "spar-maize-gp",
    buyer: "Spar Group",
    buyerType: "Retailer",
    crop: "Maize",
    region: "Gauteng",
    maxQuantityTons: 40,
    pricePerTonZAR: 5500,
    middlemanPriceZAR: 4200,
    byMonth: "Oct 2026",
  },
  {
    id: "pioneer-wheat-wc",
    buyer: "Pioneer Foods",
    buyerType: "Mill",
    crop: "Wheat",
    region: "Western Cape",
    maxQuantityTons: 30,
    pricePerTonZAR: 6800,
    middlemanPriceZAR: 5400,
    byMonth: "Nov 2026",
  },
  {
    id: "cape-soya-kzn",
    buyer: "Cape Soya Ltd",
    buyerType: "Mill",
    crop: "Soybean",
    region: "KwaZulu-Natal",
    maxQuantityTons: 20,
    pricePerTonZAR: 9500,
    middlemanPriceZAR: 7600,
    byMonth: "Sep 2026",
  },
  {
    id: "wc-brewers-sorghum",
    buyer: "Western Cape Brewers",
    buyerType: "Brewer",
    crop: "Sorghum",
    region: "Western Cape",
    maxQuantityTons: 15,
    pricePerTonZAR: 4900,
    middlemanPriceZAR: 3700,
    byMonth: "Aug 2026",
  },
  {
    id: "lentil-beans-fs",
    buyer: "Lentil Co-op",
    buyerType: "Co-op",
    crop: "Beans",
    region: "Free State",
    maxQuantityTons: 12,
    pricePerTonZAR: 11200,
    middlemanPriceZAR: 8800,
    byMonth: "Sep 2026",
  },
];

// "Your harvest listings" used to be hardcoded mock data. It now reads
// the connected farmer's on-chain Grow Packs across the last 3 seasons
// — see <FarmerHarvests /> below.

const CROP_FILTERS: Array<"All" | Crop> = [
  "All",
  "Maize",
  "Wheat",
  "Soybean",
  "Sorghum",
  "Beans",
];

const ZAR = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });

function formatRandPerTon(zarPerTon: number): string {
  return `R ${ZAR.format(zarPerTon)}/ton`;
}

function pctSavings(direct: number, middleman: number): number {
  if (middleman <= 0) return 0;
  return Math.round(((direct - middleman) / middleman) * 100);
}

type ActiveDeal = {
  cached: DemoDeal;
  /** Truthy on-chain state if the PDA still exists; null after release. */
  onChain: Deal | null;
};

export function MarketplaceTab() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [cropFilter, setCropFilter] = useState<"All" | Crop>("All");
  const [matchTarget, setMatchTarget] = useState<BuyerOffer | null>(null);
  const [deals, setDeals] = useState<ActiveDeal[]>([]);
  const [dealsRefreshKey, setDealsRefreshKey] = useState(0);

  const filteredOffers = useMemo(() => {
    if (cropFilter === "All") return BUYER_OFFERS;
    return BUYER_OFFERS.filter((o) => o.crop === cropFilter);
  }, [cropFilter]);

  // Load deals from localStorage and check each one against the chain.
  // Re-run whenever the wallet changes, or when something updates the
  // refresh key (e.g. after a successful match or release).
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
  }, [connection, publicKey, dealsRefreshKey]);

  const refreshDeals = useCallback(() => {
    setDealsRefreshKey((k) => k + 1);
  }, []);

  // Filter to deals where this wallet is buyer or farmer. Released
  // deals (PDA closed on-chain) still surface so users can see history.
  const myDeals = useMemo(() => {
    if (!publicKey) return [];
    const me = publicKey.toBase58();
    return deals.filter(
      ({ cached }) => cached.buyer === me || cached.farmer === me,
    );
  }, [deals, publicKey]);

  // Called by the match modal once create_deal is confirmed on-chain.
  const handleMatchSuccess = useCallback(
    (deal: DemoDeal) => {
      addDemoDeal(deal);
      refreshDeals();
      setMatchTarget(null);
    },
    [refreshDeals],
  );

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
      refreshDeals();
      return sig;
    },
    [publicKey, sendTransaction, connection, refreshDeals],
  );

  // The headline pitch — average savings across visible offers, in
  // percent, vs. middleman buy-back. This is the demo's "wow" number.
  const avgSavingsPct = useMemo(() => {
    if (filteredOffers.length === 0) return 0;
    const total = filteredOffers.reduce(
      (sum, o) => sum + pctSavings(o.pricePerTonZAR, o.middlemanPriceZAR),
      0,
    );
    return Math.round(total / filteredOffers.length);
  }, [filteredOffers]);

  return (
    <div className={styles.timelineSingle}>
      {/* Header pitch card */}
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
        <h3 className={styles.sessionTitle}>
          Sell direct, keep more.
        </h3>
        <p className={styles.sessionSubtitle}>
          Mills, retailers and brewers buying directly from cooperatives.
          Average <strong>{avgSavingsPct}% more</strong> than what local
          middlemen typically pay.
        </p>
      </div>

      {/* Crop filter */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          padding: "0 4px",
        }}
        role="tablist"
        aria-label="Filter buyer offers by crop"
      >
        {CROP_FILTERS.map((c) => {
          const active = cropFilter === c;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCropFilter(c)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontFamily: "inherit",
                cursor: "pointer",
                border: active
                  ? "1px solid rgba(255, 184, 107, 0.55)"
                  : "1px solid rgba(255, 230, 210, 0.14)",
                background: active
                  ? "linear-gradient(135deg, rgba(255, 123, 107, 0.18), rgba(255, 184, 107, 0.10))"
                  : "rgba(255, 255, 255, 0.04)",
                color: active ? "#ffb86b" : "rgba(255, 230, 210, 0.72)",
                transition: "all 0.15s",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Buyer offers grid */}
      <div style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255, 230, 210, 0.55)",
            fontWeight: 700,
            padding: "0 4px",
          }}
        >
          Buyers looking now
        </div>
        {filteredOffers.length === 0 ? (
          <div className={styles.box}>
            <div
              className={styles.boxBody}
              style={{ textAlign: "center", padding: 28 }}
            >
              <span
                style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.55)" }}
              >
                No offers for {cropFilter} this month. Try another crop.
              </span>
            </div>
          </div>
        ) : (
          filteredOffers.map((offer) => (
            <BuyerOfferCard
              key={offer.id}
              offer={offer}
              onMatch={() => setMatchTarget(offer)}
            />
          ))
        )}
      </div>

      {/* Phase 2 — active on-chain deals for the connected wallet */}
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

      {/* Farmer's own listings */}
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

      {/* Footnote */}
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
        Buyer offers shown above are indicative pilot pricing — SAGIS / DAFF
        spot averages, late 2024 / early 2025. Real buyers will post offers
        on-chain in Phase 3. <strong>Match Buyer locks real funds on devnet</strong>{" "}
        via the Phase 2 escrow program; pending harvests below read your{" "}
        <strong>real on-chain Grow Packs</strong>.
      </div>

      {/* Match modal — Phase 2: signs a real create_deal tx on devnet */}
      {matchTarget ? (
        <MatchModal
          offer={matchTarget}
          onClose={() => setMatchTarget(null)}
          onMatched={handleMatchSuccess}
        />
      ) : null}
    </div>
  );
}

// ============================================================================
//  Cards
// ============================================================================

function BuyerOfferCard({
  offer,
  onMatch,
}: {
  offer: BuyerOffer;
  onMatch: () => void;
}) {
  const savingsPct = pctSavings(offer.pricePerTonZAR, offer.middlemanPriceZAR);
  const savingsPerTon = offer.pricePerTonZAR - offer.middlemanPriceZAR;

  return (
    <div className={styles.box}>
      <div className={styles.boxBody}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Store size={14} style={{ color: "#ffb86b", flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "rgba(255, 245, 230, 0.95)",
                }}
              >
                {offer.buyer}
              </span>
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255, 230, 210, 0.4)",
                  fontWeight: 700,
                }}
              >
                · {offer.buyerType}
              </span>
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
              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <Sprout size={10} /> {offer.crop}
              </span>
              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <MapPin size={10} /> {offer.region}
              </span>
              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <CalendarDays size={10} /> by {offer.byMonth}
              </span>
            </div>
          </div>

          {/* Savings badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(46, 125, 50, 0.18)",
              border: "1px solid rgba(46, 125, 50, 0.45)",
              color: "#7adf7d",
              fontSize: 11,
              fontWeight: 800,
              flexShrink: 0,
            }}
            title={`Direct buyer pays R ${ZAR.format(savingsPerTon)}/ton more than the typical local middleman`}
          >
            <TrendingUp size={11} />
            +{savingsPct}% vs middleman
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "rgba(255, 245, 230, 0.95)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.1,
              }}
            >
              {formatRandPerTon(offer.pricePerTonZAR)}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255, 230, 210, 0.55)",
                marginTop: 2,
              }}
            >
              Up to <strong>{offer.maxQuantityTons} tons</strong> ·{" "}
              <span style={{ color: "rgba(255, 230, 210, 0.35)" }}>
                middleman ≈ R {ZAR.format(offer.middlemanPriceZAR)}/ton
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onMatch}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255, 184, 107, 0.5)",
              background: "rgba(255, 184, 107, 0.12)",
              color: "#ffb86b",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            Match buyer <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
//  Farmer harvests — derived from the connected farmer's on-chain Grow Packs
// ============================================================================
//
// "Your pending harvests" reads the connected wallet's Grow Packs across
// the last 3 seasons (same lookback window as the History tab) and shows
// the ones with status Approved / Active / Disbursed — i.e. the farmer
// has a pack but hasn't sold the harvest yet, so it's matchable against
// a buyer offer.
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
  const [state, setState] = useState<"loading" | "ready" | "no-wallet" | "empty" | "error">(
    "loading",
  );
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
        // Only show packs whose harvest is still ahead — Approved (just
        // approved by co-op), Active (insurance live, harvest coming),
        // Disbursed (inputs delivered). Settled packs are excluded.
        const matchable: HarvestRow[] = fetched
          .filter(
            (r): r is { season: number; packAddress: string; data: GrowPack } =>
              r.data !== null,
          )
          .filter(({ data }) =>
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
//  Match modal — Phase 2: signs a real create_deal tx on devnet
// ============================================================================
//
// The modal asks the buyer (the connected wallet) for the farmer's
// pubkey. On submit, it builds a `create_deal` instruction that locks
// DEMO_LAMPORTS into a Deal PDA seeded by (buyer, farmer, dealId).
// On success, the deal is added to the localStorage cache so the
// receiving wallet (when the user switches in Phantom) sees it under
// "Active deals".

type MatchState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "success"; signature: string; pda: string }
  | { kind: "error"; message: string };

function MatchModal({
  offer,
  onClose,
  onMatched,
}: {
  offer: BuyerOffer;
  onClose: () => void;
  onMatched: (deal: DemoDeal) => void;
}) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [farmerInput, setFarmerInput] = useState("");
  const [state, setState] = useState<MatchState>({ kind: "idle" });

  const savingsPerTon = offer.pricePerTonZAR - offer.middlemanPriceZAR;

  const handleSubmit = async () => {
    if (!publicKey || !sendTransaction) {
      setState({ kind: "error", message: "Connect a wallet first." });
      return;
    }
    let farmer: PublicKey;
    try {
      farmer = new PublicKey(farmerInput.trim());
    } catch {
      setState({
        kind: "error",
        message: "That farmer address isn't a valid Solana wallet.",
      });
      return;
    }
    if (farmer.equals(publicKey)) {
      setState({
        kind: "error",
        message:
          "Farmer wallet must be different from the buyer (your connected wallet).",
      });
      return;
    }

    setState({ kind: "busy" });
    const dealIdStr = randomDealId();
    const dealId = BigInt(dealIdStr);
    const [pda] = dealPda(publicKey, farmer, dealId);

    try {
      const ix = makeCreateDealIx({
        buyer: publicKey,
        farmer,
        dealId,
        amountLamports: DEMO_LAMPORTS,
      });
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      const stored: DemoDeal = {
        pda: pda.toBase58(),
        buyer: publicKey.toBase58(),
        farmer: farmer.toBase58(),
        dealId: dealIdStr,
        amountLamports: DEMO_LAMPORTS.toString(),
        createdAtMs: Date.now(),
        buyerOfferLabel: `${offer.buyer} · ${offer.crop}`,
        createSignature: sig,
      };
      onMatched(stored);
      setState({ kind: "success", signature: sig, pda: pda.toBase58() });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Transaction failed.",
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Match with ${offer.buyer}`}
      onClick={state.kind === "busy" ? undefined : onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 460,
          width: "100%",
          background: "#1a0f0c",
          borderRadius: 18,
          border: "1px solid rgba(255, 184, 107, 0.35)",
          padding: 22,
          boxShadow: "0 32px 80px rgba(0, 0, 0, 0.6)",
          color: "rgba(255, 245, 230, 0.95)",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={state.kind === "busy"}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 30,
            height: 30,
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 230, 210, 0.14)",
            color: "rgba(255, 230, 210, 0.72)",
            cursor: state.kind === "busy" ? "wait" : "pointer",
            opacity: state.kind === "busy" ? 0.4 : 1,
            display: "grid",
            placeItems: "center",
          }}
        >
          <X size={14} />
        </button>

        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#ffb86b",
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          {state.kind === "success" ? "Funds locked" : "Match buyer"}
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>
          {offer.buyer} · {offer.crop}
        </h3>

        {state.kind === "success" ? (
          <SuccessBody
            signature={state.signature}
            pda={state.pda}
            onClose={onClose}
          />
        ) : (
          <>
            <p
              style={{
                fontSize: 12,
                color: "rgba(255, 230, 210, 0.72)",
                lineHeight: 1.5,
                marginTop: 10,
              }}
            >
              Locks <strong>{DEMO_RAND_LABEL}</strong>{" "}
              <span style={{ color: "rgba(255, 230, 210, 0.45)" }}>
                (= 0.01 SOL on devnet)
              </span>{" "}
              until the farmer confirms delivery. Earns the farmer{" "}
              <strong>R {ZAR.format(savingsPerTon)}/ton</strong> more than
              the typical middleman price.
            </p>

            <label
              style={{
                display: "block",
                marginTop: 14,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255, 230, 210, 0.55)",
                marginBottom: 6,
              }}
            >
              Farmer wallet address
            </label>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={farmerInput}
              onChange={(e) => {
                setFarmerInput(e.target.value);
                if (state.kind === "error") setState({ kind: "idle" });
              }}
              disabled={state.kind === "busy"}
              placeholder="Paste your other wallet's address"
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "rgba(0, 0, 0, 0.38)",
                border: "1px solid rgba(255, 230, 210, 0.14)",
                borderRadius: 10,
                color: "rgba(255, 245, 230, 0.95)",
                fontSize: 12,
                fontFamily:
                  "var(--font-geist-mono), ui-monospace, monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(255, 184, 107, 0.06)",
                border: "1px solid rgba(255, 184, 107, 0.18)",
                fontSize: 11,
                color: "rgba(255, 230, 210, 0.72)",
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: "#ffb86b" }}>Demo simplification:</strong>{" "}
              the farmer themselves confirms delivery in this build. In
              production, only the cooperative officer can confirm.
            </div>

            {state.kind === "error" ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "rgba(255, 123, 107, 0.10)",
                  border: "1px solid rgba(255, 123, 107, 0.35)",
                  fontSize: 11,
                  color: "#ffb0a3",
                }}
              >
                {state.message}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={state.kind === "busy"}
                style={{
                  flex: "0 0 auto",
                  padding: "10px 16px",
                  borderRadius: 999,
                  border: "1px solid rgba(255, 230, 210, 0.14)",
                  background: "transparent",
                  color: "rgba(255, 230, 210, 0.72)",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: state.kind === "busy" ? "wait" : "pointer",
                  opacity: state.kind === "busy" ? 0.4 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={state.kind === "busy" || !farmerInput.trim()}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 999,
                  border: "none",
                  background:
                    "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                  color: "#1a0f0c",
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: "inherit",
                  cursor: state.kind === "busy" ? "wait" : "pointer",
                  opacity: state.kind === "busy" ? 0.7 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {state.kind === "busy" ? (
                  <>
                    <Loader2
                      size={14}
                      style={{ animation: "vuna-spin 0.8s linear infinite" }}
                    />
                    Signing & locking…
                  </>
                ) : (
                  <>Lock {DEMO_RAND_LABEL} <ArrowRight size={14} /></>
                )}
                <style jsx>{`
                  @keyframes vuna-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SuccessBody({
  signature,
  pda,
  onClose,
}: {
  signature: string;
  pda: string;
  onClose: () => void;
}) {
  const explorer = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  return (
    <>
      <p
        style={{
          fontSize: 12,
          color: "rgba(255, 230, 210, 0.72)",
          lineHeight: 1.5,
          marginTop: 10,
        }}
      >
        <strong style={{ color: "#7adf7d" }}>Funds are locked on-chain.</strong>{" "}
        Switch your wallet to the farmer&apos;s account in Phantom. The deal
        will appear under <em>Active deals</em>; tap{" "}
        <strong>Confirm delivery</strong> to release the funds.
      </p>
      <dl
        style={{
          marginTop: 14,
          display: "grid",
          gap: 4,
          fontSize: 10,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          color: "rgba(255, 230, 210, 0.55)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <dt>Deal</dt>
          <dd>{shortAddr(pda)}</dd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <dt>Tx</dt>
          <dd>
            <a
              href={explorer}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#ffb86b", textDecoration: "underline" }}
            >
              {shortAddr(signature)} ↗
            </a>
          </dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onClose}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "10px 16px",
          borderRadius: 999,
          border: "1px solid rgba(255, 230, 210, 0.14)",
          background: "transparent",
          color: "rgba(255, 230, 210, 0.72)",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        Done
      </button>
    </>
  );
}

// ============================================================================
//  Active deal card — shown to both buyer and farmer once a deal is locked
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
