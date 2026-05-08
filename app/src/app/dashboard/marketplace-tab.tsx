"use client";

// <MarketplaceTab /> — direct buyer ↔ farmer produce marketplace.
//
// Phase 1 (this file): pure-frontend MVP with mock listings, designed
// to demo the "skip the middleman" pitch from CLAUDE.md §3 (middlemen
// capture 40-60% of crop value). Each buyer offer shows the *direct*
// price plus an explicit "+ X% vs typical buy-back" badge, which is
// the headline number that justifies the whole product.
//
// Phase 2 (later): on-chain escrow program. Buyer locks funds when
// they match. Funds release on co-op-confirmed delivery. Out of scope
// for the hackathon demo — match buttons currently open a modal that
// explains what *would* happen.
//
// Hide-the-chain rule (CLAUDE.md §7) — this UI talks Rand, tons,
// harvest dates. Never blockchain, never USDC, never wallet.

import { useMemo, useState } from "react";
import {
  Sprout,
  MapPin,
  CalendarDays,
  ArrowRight,
  Store,
  TrendingUp,
  X,
  CheckCircle2,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import styles from "./dashboard.module.css";

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

type FarmerListing = {
  id: string;
  crop: Crop;
  region: string;
  quantityTons: number;
  askingPricePerTonZAR: number;
  harvestMonth: string;
  status: "Open" | "Matched" | "Delivered";
  matchedBuyer?: string;
};

// ─── Mock data — replace with on-chain reads in Phase 2 ───────────────
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

const FARMER_LISTINGS: FarmerListing[] = [
  {
    id: "demo-maize-1",
    crop: "Maize",
    region: "Eastern Cape",
    quantityTons: 2.5,
    askingPricePerTonZAR: 5300,
    harvestMonth: "Oct 2026",
    status: "Open",
  },
  {
    id: "demo-sorghum-1",
    crop: "Sorghum",
    region: "Eastern Cape",
    quantityTons: 1.0,
    askingPricePerTonZAR: 4900,
    harvestMonth: "Aug 2026",
    status: "Matched",
    matchedBuyer: "Western Cape Brewers",
  },
];

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

export function MarketplaceTab() {
  const { publicKey } = useWallet();
  const [cropFilter, setCropFilter] = useState<"All" | Crop>("All");
  const [matchTarget, setMatchTarget] = useState<BuyerOffer | null>(null);

  const filteredOffers = useMemo(() => {
    if (cropFilter === "All") return BUYER_OFFERS;
    return BUYER_OFFERS.filter((o) => o.crop === cropFilter);
  }, [cropFilter]);

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
            Your harvest listings
          </span>
        </div>

        {!publicKey ? (
          <div className={styles.box}>
            <div className={styles.boxBody}>
              <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.72)" }}>
                Connect your wallet to list your harvest for direct buyers.
              </span>
            </div>
          </div>
        ) : (
          FARMER_LISTINGS.map((listing) => (
            <FarmerListingCard key={listing.id} listing={listing} />
          ))
        )}
      </div>

      {/* Footnote */}
      <div
        style={{
          fontSize: 10,
          color: "rgba(255, 230, 210, 0.4)",
          padding: "4px 6px",
          textAlign: "center",
          letterSpacing: "0.04em",
        }}
      >
        Prices are illustrative — based on SAGIS &amp; DAFF spot averages.
        Direct settlement coming soon.
      </div>

      {/* Match modal */}
      {matchTarget ? (
        <MatchModal offer={matchTarget} onClose={() => setMatchTarget(null)} />
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

function FarmerListingCard({ listing }: { listing: FarmerListing }) {
  const statusColor =
    listing.status === "Matched"
      ? "#7adf7d"
      : listing.status === "Delivered"
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
              {listing.quantityTons} tons {listing.crop}
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
                <MapPin size={10} /> {listing.region}
              </span>
              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <CalendarDays size={10} /> harvest {listing.harvestMonth}
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
            {listing.status}
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
              fontSize: 18,
              fontWeight: 800,
              color: "rgba(255, 245, 230, 0.95)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Asking {formatRandPerTon(listing.askingPricePerTonZAR)}
          </span>
          {listing.matchedBuyer ? (
            <span
              style={{
                fontSize: 11,
                color: "rgba(255, 230, 210, 0.72)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <CheckCircle2 size={11} style={{ color: "#7adf7d" }} />
              {listing.matchedBuyer}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
//  Match modal — Phase 2 placeholder
// ============================================================================

function MatchModal({
  offer,
  onClose,
}: {
  offer: BuyerOffer;
  onClose: () => void;
}) {
  const savingsPerTon = offer.pricePerTonZAR - offer.middlemanPriceZAR;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Match with ${offer.buyer}`}
      onClick={onClose}
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
          maxWidth: 440,
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
            cursor: "pointer",
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
          Match preview
        </div>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 800,
            margin: "0 0 6px",
          }}
        >
          {offer.buyer} · {offer.crop}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255, 230, 210, 0.72)",
            lineHeight: 1.5,
            marginTop: 10,
          }}
        >
          When you match this buyer, the deal will be locked in:
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "12px 0",
            display: "grid",
            gap: 6,
            fontSize: 12,
            color: "rgba(255, 230, 210, 0.85)",
          }}
        >
          <li>
            • Buyer commits up to <strong>{offer.maxQuantityTons} tons</strong>{" "}
            at <strong>{formatRandPerTon(offer.pricePerTonZAR)}</strong>
          </li>
          <li>
            • Funds are held in escrow by your cooperative until delivery
          </li>
          <li>
            • You earn <strong>R {ZAR.format(savingsPerTon)}/ton more</strong>{" "}
            than the local middleman pays
          </li>
          <li>
            • Delivery confirmed by the cooperative releases payment to you
            within 48 hours
          </li>
        </ul>

        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(255, 184, 107, 0.08)",
            border: "1px solid rgba(255, 184, 107, 0.25)",
            fontSize: 11,
            color: "rgba(255, 230, 210, 0.72)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "#ffb86b" }}>Coming soon:</strong>{" "}
          on-chain escrow + delivery confirmation. For the demo, matching is
          previewed only — no commitment is created yet.
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
