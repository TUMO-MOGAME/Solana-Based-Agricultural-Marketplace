"use client";

// <MarketplaceTab /> — direct buyer ↔ farmer marketplace.
//
// Phase 3 (current): everything on this tab is real on-chain data.
//
//   1. Buyer offers — `BuyerOffer` PDAs scanned via getProgramAccounts.
//      Anyone with a wallet can post via the Post-offer modal (clearly
//      labelled as a demo / buyer-side surface). The original poster
//      can cancel their own offer; rent is refunded to them.
//   2. Active deals — Phase 2 escrow PDAs (Deal accounts) where the
//      connected wallet is buyer or farmer.
//   3. Your pending harvests — the connected farmer's Grow Packs.
//
// Match flow: tapping Match on an offer opens a modal that signs a
// Phase 2 `create_deal` against (connected wallet → entered farmer
// pubkey). The connected wallet IS the buyer for that deal, so the
// demo flow is "stay on buyer wallet → match → switch to farmer wallet
// → confirm delivery → SOL flows."
//
// The dashboard is farmer-facing per CLAUDE.md, so the buyer-side
// surfaces (Post offer, Match offer) are clearly framed as developer /
// pilot-facing demo surfaces. A real production buyer dApp will live
// at a separate route.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Store,
  TrendingUp,
  ArrowRight,
  Plus,
  X,
  Trash2,
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  fetchDeal,
  fetchDealsByWallet,
  makeConfirmAndReleaseIx,
  makeCreateDealIx,
  makePostBuyerOfferIx,
  makeCancelBuyerOfferIx,
  fetchAllBuyerOffers,
  farmerIdHashFrom,
  farmerPda,
  packPda,
  fetchGrowPack,
  CROP_LABELS,
  REGION_LABELS,
  BUYER_TYPE_LABELS,
  type Deal,
  type GrowPack,
  type BuyerOffer,
} from "@/lib/vuna/program";
import {
  readDemoDeals,
  addDemoDeal,
  removeDemoDeal,
  randomDealId,
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

type OfferRow = {
  address: PublicKey;
  offer: BuyerOffer;
};

export function MarketplaceTab() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [deals, setDeals] = useState<ActiveDeal[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [offerLoadState, setOfferLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [offerError, setOfferError] = useState("");

  const [postModalOpen, setPostModalOpen] = useState(false);
  const [matchTarget, setMatchTarget] = useState<OfferRow | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Load deals + offers in parallel.
  //
  // Deals come from two sources, merged by PDA:
  //   1. localStorage (fast, includes historical released deals) — but
  //      only present in the browser/profile that did the create_deal.
  //   2. On-chain scan via getProgramAccounts, filtered to deals where
  //      the connected wallet is buyer or farmer — works in any browser.
  //
  // Merging means: a fresh Phantom on a different machine can still see
  // active deals it's a party to, *and* the original browser can still
  // see released history that's no longer on-chain.
  useEffect(() => {
    let cancelled = false;
    setOfferLoadState("loading");
    setOfferError("");

    (async () => {
      const [cachedEnriched, scanned, fetchedOffers] = await Promise.all([
        // 1. localStorage cached deals + their current on-chain state
        (async () => {
          const cached = readDemoDeals();
          return Promise.all(
            cached.map(async (d) => {
              try {
                const onChain = await fetchDeal(connection, new PublicKey(d.pda));
                return { cached: d, onChain };
              } catch {
                return { cached: d, onChain: null };
              }
            }),
          );
        })(),
        // 2. On-chain scan for the connected wallet
        (async () => {
          if (!publicKey) return [];
          try {
            return await fetchDealsByWallet(connection, publicKey);
          } catch {
            // Network hiccup — fall back to whatever localStorage gives us.
            return [];
          }
        })(),
        // 3. All buyer offers
        (async () => {
          try {
            return { ok: true as const, rows: await fetchAllBuyerOffers(connection) };
          } catch (e) {
            return {
              ok: false as const,
              error: e instanceof Error ? e.message : String(e),
            };
          }
        })(),
      ]);

      if (cancelled) return;

      // Merge by PDA. localStorage entries take precedence (they may have
      // a buyerOfferLabel the on-chain account doesn't carry).
      const byPda = new Map<string, ActiveDeal>();
      for (const row of cachedEnriched) {
        byPda.set(row.cached.pda, row);
      }
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
      // Sort newest first.
      const merged = Array.from(byPda.values()).sort(
        (a, b) => b.cached.createdAtMs - a.cached.createdAtMs,
      );
      setDeals(merged);

      if (fetchedOffers.ok) {
        const now = Math.floor(Date.now() / 1000);
        const live = fetchedOffers.rows.filter(
          (r) => Number(r.offer.expiresAt) > now,
        );
        live.sort((a, b) => Number(b.offer.createdAt - a.offer.createdAt));
        setOffers(live);
        setOfferLoadState("ready");
      } else {
        setOffers([]);
        setOfferError(fetchedOffers.error);
        setOfferLoadState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connection, publicKey, refreshKey]);

  const myDeals = useMemo(() => {
    if (!publicKey) return [];
    const me = publicKey.toBase58();
    return deals.filter(
      ({ cached }) => cached.buyer === me || cached.farmer === me,
    );
  }, [deals, publicKey]);

  // ---- handlers --------------------------------------------------------

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
      removeDemoDeal(active.cached.pda);
      refresh();
      return sig;
    },
    [publicKey, sendTransaction, connection, refresh],
  );

  const handleCancelOffer = useCallback(
    async (row: OfferRow) => {
      if (!publicKey || !sendTransaction) {
        throw new Error("Connect a wallet first.");
      }
      if (publicKey.toBase58() !== row.offer.buyer.toBase58()) {
        throw new Error("Only the original buyer can cancel this offer.");
      }
      const ix = makeCancelBuyerOfferIx({
        offer: row.address,
        buyer: publicKey,
      });
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      refresh();
      return sig;
    },
    [publicKey, sendTransaction, connection, refresh],
  );

  // Average savings shown in the headline pitch card. Computed live
  // from the offers that are visible right now.
  const avgSavingsPct = useMemo(() => {
    const usable = offers.filter(
      (r) => r.offer.middlemanPriceZar > 0n,
    );
    if (usable.length === 0) return null;
    const total = usable.reduce((sum, r) => {
      const direct = Number(r.offer.pricePerTonZar);
      const mid = Number(r.offer.middlemanPriceZar);
      if (mid <= 0) return sum;
      return sum + ((direct - mid) / mid) * 100;
    }, 0);
    return Math.round(total / usable.length);
  }, [offers]);

  return (
    <div className={styles.timelineSingle}>
      {/* Pitch card */}
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
          {avgSavingsPct !== null
            ? `Sell direct for ${avgSavingsPct}% more.`
            : "Skip the middleman."}
        </h3>
        <p className={styles.sessionSubtitle}>
          Mills, retailers and brewers post offers on-chain. Tap{" "}
          <strong>Match</strong> to lock funds in escrow; pay the farmer
          automatically when delivery is confirmed.
        </p>
      </div>

      {/* Active deals — only when this wallet has any */}
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

      {/* Buyer offers section */}
      <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 4px",
            gap: 8,
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
            Buyer offers (live on devnet)
          </span>
          <button
            type="button"
            onClick={() => setPostModalOpen(true)}
            disabled={!publicKey}
            title={
              !publicKey
                ? "Connect a wallet to post an offer"
                : "Post a buyer offer (acts as the buyer)"
            }
            style={{
              padding: "5px 11px",
              borderRadius: 999,
              border: "1px solid rgba(255, 184, 107, 0.45)",
              background: publicKey
                ? "rgba(255, 184, 107, 0.10)"
                : "rgba(255, 255, 255, 0.04)",
              color: publicKey ? "#ffb86b" : "rgba(255, 230, 210, 0.45)",
              fontSize: 10,
              fontWeight: 800,
              fontFamily: "inherit",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: publicKey ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Plus size={11} /> Post offer (demo)
          </button>
        </div>

        {offerLoadState === "loading" ? (
          <div className={styles.box}>
            <div
              className={styles.boxBody}
              style={{ textAlign: "center", padding: 24 }}
            >
              <span style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.55)" }}>
                Reading buyer offers from devnet…
              </span>
            </div>
          </div>
        ) : offerLoadState === "error" ? (
          <div className={styles.box}>
            <div className={styles.boxBody}>
              <span style={{ fontSize: 12, color: "#ffb0a3" }}>
                Couldn&apos;t reach the chain — {offerError}
              </span>
            </div>
          </div>
        ) : offers.length === 0 ? (
          <div className={styles.box}>
            <div className={styles.boxBody}>
              <span style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.72)" }}>
                No live buyer offers yet. Tap{" "}
                <strong>Post offer (demo)</strong> with your buyer wallet to
                add one — it&apos;ll appear here for any farmer wallet to match.
              </span>
            </div>
          </div>
        ) : (
          offers.map((row) => (
            <BuyerOfferCard
              key={row.address.toBase58()}
              row={row}
              connectedWallet={publicKey}
              onMatch={() => setMatchTarget(row)}
              onCancel={() => handleCancelOffer(row)}
            />
          ))
        )}
      </div>

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
        All sections above read live data from devnet. Buyer offers are
        on-chain <code>BuyerOffer</code> PDAs; matches lock real lamports
        into <code>Deal</code> escrow PDAs that release on farmer
        confirmation.
      </div>

      {/* Modals */}
      {postModalOpen && publicKey ? (
        <PostOfferModal
          buyer={publicKey}
          connection={connection}
          sendTransaction={async (tx) => {
            const sig = await sendTransaction(tx, connection);
            await connection.confirmTransaction(sig, "confirmed");
            return sig;
          }}
          onClose={() => setPostModalOpen(false)}
          onPosted={() => {
            setPostModalOpen(false);
            refresh();
          }}
        />
      ) : null}

      {matchTarget && publicKey ? (
        <MatchOfferModal
          row={matchTarget}
          connectedWallet={publicKey}
          connection={connection}
          sendTransaction={async (tx) => {
            const sig = await sendTransaction(tx, connection);
            await connection.confirmTransaction(sig, "confirmed");
            return sig;
          }}
          onClose={() => setMatchTarget(null)}
          onMatched={() => {
            setMatchTarget(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

// ============================================================================
//  Buyer offer card
// ============================================================================

function BuyerOfferCard({
  row,
  connectedWallet,
  onMatch,
  onCancel,
}: {
  row: OfferRow;
  connectedWallet: PublicKey | null;
  onMatch: () => void;
  onCancel: () => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const o = row.offer;
  const direct = Number(o.pricePerTonZar);
  const middleman = Number(o.middlemanPriceZar);
  const savingsPct =
    middleman > 0 ? Math.round(((direct - middleman) / middleman) * 100) : null;
  const savingsPerTon = direct - middleman;
  const cropLabel = CROP_LABELS[o.crop] ?? `crop#${o.crop}`;
  const regionLabel = REGION_LABELS[o.region] ?? `region#${o.region}`;
  const buyerTypeLabel = BUYER_TYPE_LABELS[o.buyerType] ?? "Buyer";
  const isOwner =
    connectedWallet && connectedWallet.toBase58() === o.buyer.toBase58();
  const expiresMonth = new Date(Number(o.expiresAt) * 1000).toLocaleDateString(
    "en-ZA",
    { month: "short", year: "numeric" },
  );

  const handleCancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

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
                {o.buyerName || "Unnamed buyer"}
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
                · {buyerTypeLabel}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                fontSize: 11,
                color: "rgba(255, 230, 210, 0.55)",
              }}
            >
              <span>{cropLabel}</span>
              <span>{regionLabel}</span>
              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <CalendarDays size={10} /> by {expiresMonth}
              </span>
            </div>
          </div>

          {savingsPct !== null && savingsPct > 0 ? (
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
              <TrendingUp size={11} />+{savingsPct}% vs middleman
            </div>
          ) : null}
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
              R {ZAR.format(direct)}/ton
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255, 230, 210, 0.55)",
                marginTop: 2,
              }}
            >
              Up to <strong>{o.maxQuantityTons} tons</strong>
              {middleman > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span style={{ color: "rgba(255, 230, 210, 0.35)" }}>
                    middleman ≈ R {ZAR.format(middleman)}/ton
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {isOwner ? (
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                title="Cancel this offer (you posted it)"
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(192, 57, 43, 0.5)",
                  background: "rgba(192, 57, 43, 0.10)",
                  color: "#ff9b8e",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: busy ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? <Loader2 size={11} /> : <Trash2 size={11} />} Cancel
              </button>
            ) : null}
            <button
              type="button"
              onClick={onMatch}
              disabled={!connectedWallet}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255, 184, 107, 0.5)",
                background: connectedWallet
                  ? "rgba(255, 184, 107, 0.12)"
                  : "rgba(255, 255, 255, 0.04)",
                color: connectedWallet ? "#ffb86b" : "rgba(255, 230, 210, 0.45)",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: connectedWallet ? "pointer" : "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Match buyer <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {error ? (
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
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
//  Post offer modal
// ============================================================================

function PostOfferModal({
  buyer,
  sendTransaction,
  onClose,
  onPosted,
}: {
  buyer: PublicKey;
  connection: import("@solana/web3.js").Connection;
  sendTransaction: (tx: Transaction) => Promise<string>;
  onClose: () => void;
  onPosted: (signature: string) => void;
}) {
  const [buyerName, setBuyerName] = useState("Lebone Mills");
  const [crop, setCrop] = useState(0); // Maize
  const [region, setRegion] = useState(0); // Eastern Cape
  const [buyerType, setBuyerType] = useState(0); // Mill
  const [maxTons, setMaxTons] = useState(50);
  const [pricePerTon, setPricePerTon] = useState(5400);
  const [middlemanPrice, setMiddlemanPrice] = useState(4200);
  const [validForDays, setValidForDays] = useState(60);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      const offerId = BigInt(randomDealId());
      const expiresAt = BigInt(
        Math.floor(Date.now() / 1000) + validForDays * 86400,
      );
      const ix = makePostBuyerOfferIx({
        buyer,
        offerId,
        crop,
        region,
        buyerType,
        maxQuantityTons: maxTons,
        pricePerTonZar: BigInt(pricePerTon),
        middlemanPriceZar: BigInt(middlemanPrice),
        expiresAt,
        buyerName,
      });
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx);
      onPosted(sig);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose} ariaLabel="Post buyer offer">
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
        DEMO: post offer (acts as the buyer)
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>
        New buyer offer
      </h3>
      <p
        style={{
          fontSize: 12,
          color: "rgba(255, 230, 210, 0.65)",
          margin: "0 0 14px",
          lineHeight: 1.5,
        }}
      >
        Posts as the connected wallet — you&apos;re the buyer for this
        offer. Any farmer wallet can match it. Rent is refunded on cancel.
      </p>

      <Field label="Buyer name (max 32 chars)">
        <input
          type="text"
          value={buyerName}
          maxLength={32}
          onChange={(e) => setBuyerName(e.target.value)}
          style={modalInput}
        />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Crop">
          <select
            value={crop}
            onChange={(e) => setCrop(Number(e.target.value))}
            style={modalInput}
          >
            {CROP_LABELS.map((c, i) => (
              <option key={i} value={i}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Region">
          <select
            value={region}
            onChange={(e) => setRegion(Number(e.target.value))}
            style={modalInput}
          >
            {REGION_LABELS.map((r, i) => (
              <option key={i} value={i}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Buyer type">
        <select
          value={buyerType}
          onChange={(e) => setBuyerType(Number(e.target.value))}
          style={modalInput}
        >
          {BUYER_TYPE_LABELS.map((b, i) => (
            <option key={i} value={i}>
              {b}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Max tons">
          <input
            type="number"
            min={1}
            value={maxTons}
            onChange={(e) => setMaxTons(Math.max(1, Number(e.target.value) || 0))}
            style={modalInput}
          />
        </Field>
        <Field label="Valid for (days)">
          <input
            type="number"
            min={1}
            max={365}
            value={validForDays}
            onChange={(e) =>
              setValidForDays(Math.max(1, Number(e.target.value) || 0))
            }
            style={modalInput}
          />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Direct price (R/ton)">
          <input
            type="number"
            min={1}
            value={pricePerTon}
            onChange={(e) =>
              setPricePerTon(Math.max(1, Number(e.target.value) || 0))
            }
            style={modalInput}
          />
        </Field>
        <Field label="Middleman price (R/ton)">
          <input
            type="number"
            min={0}
            value={middlemanPrice}
            onChange={(e) =>
              setMiddlemanPrice(Math.max(0, Number(e.target.value) || 0))
            }
            style={modalInput}
          />
        </Field>
      </div>

      {error ? <ModalError message={error} /> : null}

      <ModalButtons
        primary={{
          label: busy ? "Posting…" : "Post offer",
          onClick: handleSubmit,
          disabled: busy || !buyerName.trim(),
          icon: busy ? <Loader2 size={11} /> : <Plus size={11} />,
        }}
        secondary={{ label: "Cancel", onClick: onClose }}
      />
    </ModalShell>
  );
}

// ============================================================================
//  Match offer modal
// ============================================================================

function MatchOfferModal({
  row,
  connectedWallet,
  sendTransaction,
  onClose,
  onMatched,
}: {
  row: OfferRow;
  connectedWallet: PublicKey;
  connection: import("@solana/web3.js").Connection;
  sendTransaction: (tx: Transaction) => Promise<string>;
  onClose: () => void;
  onMatched: (signature: string) => void;
}) {
  const [farmerStr, setFarmerStr] = useState("");
  const [solStr, setSolStr] = useState("0.01");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const o = row.offer;
  const cropLabel = CROP_LABELS[o.crop] ?? `crop#${o.crop}`;
  const youArePoster =
    connectedWallet.toBase58() === o.buyer.toBase58();

  const handleSubmit = async () => {
    setError(null);
    let farmerPubkey: PublicKey;
    try {
      farmerPubkey = new PublicKey(farmerStr.trim());
    } catch {
      setError("That farmer address isn't a valid Solana pubkey.");
      return;
    }
    if (farmerPubkey.toBase58() === connectedWallet.toBase58()) {
      setError(
        "Farmer must be a different wallet from the buyer (you). Switch to your other wallet's address.",
      );
      return;
    }
    let amountLamports: bigint;
    try {
      const sol = Number(solStr);
      if (!isFinite(sol) || sol <= 0) throw new Error("not positive");
      amountLamports = BigInt(Math.round(sol * LAMPORTS_PER_SOL));
      if (amountLamports <= 0n) throw new Error("zero lamports");
    } catch {
      setError("Enter a positive SOL amount.");
      return;
    }

    setBusy(true);
    try {
      const dealId = BigInt(randomDealId());
      const ix = makeCreateDealIx({
        buyer: connectedWallet,
        farmer: farmerPubkey,
        dealId,
        amountLamports,
      });
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx);

      // Cache so the farmer's view of this browser can find the PDA.
      const { dealPda } = await import("@/lib/vuna/program");
      const [pda] = dealPda(connectedWallet, farmerPubkey, dealId);
      addDemoDeal({
        pda: pda.toBase58(),
        buyer: connectedWallet.toBase58(),
        farmer: farmerPubkey.toBase58(),
        dealId: dealId.toString(),
        amountLamports: amountLamports.toString(),
        createdAtMs: Date.now(),
        buyerOfferLabel: `${o.buyerName || "Buyer"} · ${cropLabel}`,
        createSignature: sig,
      });
      onMatched(sig);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose} ariaLabel="Match offer">
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
        Match buyer offer
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>
        {o.buyerName || "Unnamed buyer"} · {cropLabel}
      </h3>
      <p
        style={{
          fontSize: 12,
          color: "rgba(255, 230, 210, 0.65)",
          margin: "0 0 14px",
          lineHeight: 1.5,
        }}
      >
        You&apos;re committing as the buyer at{" "}
        <strong>R {ZAR.format(Number(o.pricePerTonZar))}/ton</strong>. Lamports
        lock into a Deal PDA on devnet — they release to the farmer when
        delivery is confirmed.
      </p>

      {!youArePoster ? (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            marginBottom: 10,
            background: "rgba(255, 184, 107, 0.08)",
            border: "1px solid rgba(255, 184, 107, 0.25)",
            fontSize: 11,
            color: "rgba(255, 230, 210, 0.65)",
          }}
        >
          Heads up — this offer was posted by a different wallet. You&apos;re
          committing your own funds; the offer&apos;s posted buyer is just
          marketing copy here.
        </div>
      ) : null}

      <Field label="Farmer wallet (the address that will receive the funds)">
        <input
          type="text"
          value={farmerStr}
          onChange={(e) => setFarmerStr(e.target.value)}
          placeholder="Paste your other wallet's address"
          style={{ ...modalInput, fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
        />
      </Field>

      <Field label="Lock amount (SOL — stand-in for ZAR-stablecoin on devnet)">
        <input
          type="text"
          inputMode="decimal"
          value={solStr}
          onChange={(e) => setSolStr(e.target.value)}
          placeholder="0.01"
          style={modalInput}
        />
      </Field>
      <div
        style={{
          fontSize: 10,
          color: "rgba(255, 230, 210, 0.4)",
          marginTop: -4,
          marginBottom: 8,
        }}
      >
        ≈ R {Math.round(Number(solStr || "0") * 1000)} (using a 1 SOL = R 1,000 demo peg)
      </div>

      {error ? <ModalError message={error} /> : null}

      <ModalButtons
        primary={{
          label: busy ? "Locking…" : "Lock funds & match",
          onClick: handleSubmit,
          disabled: busy || !farmerStr.trim() || !solStr.trim(),
          icon: busy ? <Loader2 size={11} /> : <ShieldCheck size={11} />,
        }}
        secondary={{ label: "Cancel", onClick: onClose }}
      />
    </ModalShell>
  );
}

// ============================================================================
//  Modal primitives — shared by Post and Match modals
// ============================================================================

function ModalShell({
  ariaLabel,
  onClose,
  children,
}: {
  ariaLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
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
          maxWidth: 460,
          width: "100%",
          background: "#1a0f0c",
          borderRadius: 18,
          border: "1px solid rgba(255, 184, 107, 0.35)",
          padding: 22,
          boxShadow: "0 32px 80px rgba(0, 0, 0, 0.6)",
          color: "rgba(255, 245, 230, 0.95)",
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
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
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span
        style={{
          display: "block",
          fontSize: 9,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          color: "rgba(255, 230, 210, 0.55)",
          marginBottom: 5,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const modalInput: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.38)",
  border: "1px solid rgba(255, 230, 210, 0.14)",
  borderRadius: 10,
  padding: "9px 12px",
  color: "rgba(255, 245, 230, 0.95)",
  fontSize: 13,
  fontWeight: 600,
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

function ModalError({ message }: { message: string }) {
  return (
    <div
      style={{
        marginBottom: 8,
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(255, 123, 107, 0.10)",
        border: "1px solid rgba(255, 123, 107, 0.35)",
        fontSize: 11,
        color: "#ffb0a3",
      }}
    >
      {message}
    </div>
  );
}

function ModalButtons({
  primary,
  secondary,
}: {
  primary: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    icon?: React.ReactNode;
  };
  secondary: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
      <button
        type="button"
        onClick={secondary.onClick}
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
        {secondary.label}
      </button>
      <button
        type="button"
        onClick={primary.onClick}
        disabled={primary.disabled}
        style={{
          flex: 2,
          padding: "10px 16px",
          borderRadius: 999,
          border: "none",
          background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
          color: "#1a0f0c",
          fontSize: 12,
          fontWeight: 800,
          fontFamily: "inherit",
          cursor: primary.disabled ? "not-allowed" : "pointer",
          opacity: primary.disabled ? 0.55 : 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {primary.icon}
        {primary.label}
      </button>
    </div>
  );
}

// ============================================================================
//  Farmer harvests — derived from the connected farmer's on-chain Grow Packs
// ============================================================================

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
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
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
