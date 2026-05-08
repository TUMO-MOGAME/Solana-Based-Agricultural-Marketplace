"use client";

// <ApplyTab /> — apply for a Grow Pack.
//
// Single source of truth for the application form. Used:
//   1) Embedded in /dashboard as the "Apply" profile-menu tab (no route hop)
//   2) Standalone at /grow-pack/new (for shareable URLs)
//
// On submit, builds register_farmer + request_grow_pack instructions and
// signs them with the connected wallet.
//
// Visual styling matches the dark-plum / coral-amber dashboard shell so
// the embedded version doesn't break immersion. The standalone page wraps
// it in a min-h-screen container.

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Sprout, MapPin, Loader2, ArrowRight } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Transaction, type TransactionSignature } from "@solana/web3.js";
import {
  farmerIdHashFrom,
  makeRegisterFarmerIx,
  makeRequestGrowPackIx,
  packPda,
  farmerPda,
  quoteGrowPack,
  SERVICE_FEE_BPS_DEFAULT,
  fetchFarmerAccount,
  fetchGrowPack,
} from "@/lib/vuna/program";
import styles from "./dashboard.module.css";

const DEFAULT_SEED_COST = 420;
const DEFAULT_FERTILIZER_COST = 1_150;
const DEFAULT_INSURANCE_COST = 85;
const DEFAULT_THRESHOLD_PERCENT = 80;
const DEFAULT_MAX_PAYOUT = 1_750;
const CURRENT_SEASON_ID = new Date().getFullYear();

const REGIONS = [
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

const CROPS = ["Maize", "Wheat", "Soybean", "Sorghum", "Beans"];

export interface ApplyTabProps {
  /** Called once a Grow Pack has been successfully submitted on-chain. */
  onSuccess?: (info: { packAddress: string; txSignature: TransactionSignature }) => void;
  /**
   * Called when the user wants to jump from the Apply tab to the Insurance
   * tab — e.g. after we detect they already have an active pack for the
   * season. Optional so the standalone /grow-pack/new page (which has no
   * sibling Insurance tab) can omit it.
   */
  onNavigateToInsurance?: () => void;
}

export function ApplyTab({ onSuccess, onNavigateToInsurance }: ApplyTabProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connecting } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [crop, setCrop] = useState("Maize");
  const [hectares, setHectares] = useState("2.0");
  const [region, setRegion] = useState(0);
  const [seedCost, setSeedCost] = useState(DEFAULT_SEED_COST);
  const [fertilizerCost, setFertilizerCost] = useState(DEFAULT_FERTILIZER_COST);
  const [insuranceCost, setInsuranceCost] = useState(DEFAULT_INSURANCE_COST);
  const [thresholdPercent] = useState(DEFAULT_THRESHOLD_PERCENT);
  const [maxPayout] = useState(DEFAULT_MAX_PAYOUT);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When set, the error is "you already have a pack for this season".
  // Holding the address separately lets us render a clickable
  // "Open on Insurance tab" action without parsing the error string.
  const [existingPackAddress, setExistingPackAddress] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ sig: TransactionSignature; pack: string } | null>(null);

  const quote = useMemo(
    () =>
      quoteGrowPack(
        seedCost,
        fertilizerCost,
        insuranceCost,
        SERVICE_FEE_BPS_DEFAULT,
      ),
    [seedCost, fertilizerCost, insuranceCost],
  );

  useEffect(() => {
    if (publicKey) setError(null);
  }, [publicKey]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setExistingPackAddress(null);
    setSuccess(null);

    if (!publicKey) {
      setError("Connect your wallet first to submit on-chain.");
      setWalletModalVisible(true);
      return;
    }

    setBusy(true);
    try {
      const farmerIdHash = await farmerIdHashFrom(publicKey.toBase58());
      const [farmerAcc] = farmerPda(publicKey, farmerIdHash);
      const [packAcc] = packPda(farmerAcc, CURRENT_SEASON_ID);

      // Pre-flight: a farmer can only have ONE Grow Pack per season — the
      // pack PDA is deterministic in (farmer, season). If the pack already
      // exists on-chain, the underlying init would fail with an opaque
      // "account already in use" error from the system program. Catch it
      // here and surface a useful message instead.
      const existingPack = await fetchGrowPack(connection, packAcc);
      if (existingPack) {
        setBusy(false);
        const addr = packAcc.toBase58();
        setExistingPackAddress(addr);
        setError(
          `You already have an active Grow Pack for ${CURRENT_SEASON_ID} (${addr.slice(0, 4)}…${addr.slice(-4)}).`,
        );
        return;
      }

      const existingFarmer = await fetchFarmerAccount(connection, farmerAcc);

      const tx = new Transaction();
      if (!existingFarmer) {
        tx.add(
          makeRegisterFarmerIx({
            cooperative: publicKey,
            farmerIdHash,
            region,
          }),
        );
      }
      tx.add(
        makeRequestGrowPackIx({
          cooperative: publicKey,
          farmerIdHash,
          seasonId: CURRENT_SEASON_ID,
          seedCost: BigInt(seedCost),
          fertilizerCost: BigInt(fertilizerCost),
          insuranceCost: BigInt(insuranceCost),
          serviceFeeBps: SERVICE_FEE_BPS_DEFAULT,
          thresholdPercent,
          maxPayout: BigInt(maxPayout),
        }),
      );

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      const packAddress = packAcc.toBase58();
      setSuccess({ sig, pack: packAddress });
      onSuccess?.({ packAddress, txSignature: sig });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to submit Grow Pack request.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <div className={styles.timelineSingle}>
        <div
          className={`${styles.box} ${styles.session}`}
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 184, 107, 0.18), rgba(255, 123, 107, 0.10))",
            border: "1px solid rgba(255, 184, 107, 0.45)",
          }}
        >
          <div className={styles.sessionEyebrow}>
            <span className={styles.sessionDot} />
            Submitted
          </div>
          <h3 className={styles.sessionTitle}>
            Your Grow Pack request is on chain.
          </h3>
          <p className={styles.sessionSubtitle}>
            The cooperative reviews requests within 48 hours. You&apos;ll get
            a notification when your inputs are scheduled for delivery.
          </p>
          <dl
            style={{
              marginTop: 14,
              display: "grid",
              gap: 4,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: 11,
              color: "rgba(255, 230, 210, 0.55)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <dt>Pack</dt>
              <dd style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {success.pack}
              </dd>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <dt>Tx</dt>
              <dd style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>
                {success.sig}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  const repayPreview = quote.totalRepayment;

  return (
    <div className={styles.timelineSingle}>
      <form onSubmit={handleSubmit}>
        <div className={styles.timelinePair}>
          {/* Crop + region + hectares column */}
          <div className={styles.box}>
            <div className={styles.boxHeader}>
              <h2 className={styles.boxTitle}>Plan next season</h2>
              <span className={styles.boxLabel}>Apply</span>
            </div>
            <div className={styles.boxBody} style={{ display: "grid", gap: 10 }}>
              <Field label="Crop">
                <select
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  style={fieldInput}
                >
                  {CROPS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                <Field label="Hectares">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    value={hectares}
                    onChange={(e) => setHectares(e.target.value)}
                    style={fieldInput}
                  />
                </Field>
                <Field label="Region">
                  <select
                    value={region}
                    onChange={(e) => setRegion(Number(e.target.value))}
                    style={fieldInput}
                  >
                    {REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                <Chip icon={<Sprout size={11} />} label={`${crop} · ${hectares} ha`} />
                <Chip icon={<MapPin size={11} />} label={REGIONS[region]?.label ?? ""} />
              </div>
            </div>
          </div>

          {/* Bundle preview column */}
          <div className={`${styles.box} ${styles.session}`}>
            <div className={styles.sessionEyebrow}>
              <span className={styles.sessionDot} />
              Your Grow Pack
            </div>
            <div style={{ display: "grid", gap: 2, marginTop: 8 }}>
              <BundleRow
                label="Certified seed"
                cost={seedCost}
                setCost={setSeedCost}
              />
              <BundleRow
                label="Fertilizer"
                cost={fertilizerCost}
                setCost={setFertilizerCost}
              />
              <BundleRow
                label="Drought insurance"
                cost={insuranceCost}
                setCost={setInsuranceCost}
              />
            </div>
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: "1px solid rgba(255, 230, 210, 0.14)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255, 245, 230, 0.95)" }}>
                Total today
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "rgba(255, 245, 230, 0.95)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                R {quote.bundleCost.toLocaleString("en-ZA")}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "rgba(255, 230, 210, 0.55)" }}>
                Repay at harvest
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#ffb86b",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                ≈ R {repayPreview.toLocaleString("en-ZA")}
              </span>
            </div>
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginTop: 12,
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 12,
              background: "rgba(255, 123, 107, 0.10)",
              border: "1px solid rgba(255, 123, 107, 0.35)",
              color: "#ffb0a3",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span>{error}</span>
            {existingPackAddress && onNavigateToInsurance ? (
              <button
                type="button"
                onClick={onNavigateToInsurance}
                style={{
                  alignSelf: "flex-start",
                  padding: "6px 12px",
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
                }}
              >
                Open on Insurance tab <ArrowRight size={12} />
              </button>
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="submit"
            disabled={busy || connecting}
            style={{
              flex: 1,
              padding: "12px 20px",
              borderRadius: 999,
              border: "none",
              fontSize: 14,
              fontWeight: 800,
              fontFamily: "inherit",
              background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
              color: "#1a0f0c",
              boxShadow: "0 14px 32px rgba(255, 123, 107, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: busy ? "wait" : "pointer",
              opacity: busy || connecting ? 0.55 : 1,
              transition: "filter 0.15s",
            }}
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Submitting…
              </>
            ) : !publicKey ? (
              <>Connect wallet to apply <ArrowRight size={14} /></>
            ) : (
              <>Apply for this Grow Pack <ArrowRight size={14} /></>
            )}
          </button>
        </div>
        <p
          style={{
            textAlign: "center",
            marginTop: 8,
            fontSize: 10,
            color: "rgba(255, 230, 210, 0.45)",
            letterSpacing: "0.04em",
          }}
        >
          Your cooperative reviews requests within 48 hours.
        </p>
      </form>
    </div>
  );
}

const fieldInput: React.CSSProperties = {
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontSize: 9,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
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

function BundleRow({
  label,
  cost,
  setCost,
}: {
  label: string;
  cost: number;
  setCost: (n: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "5px 0",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.85)" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            fontSize: 11,
            color: "rgba(255, 230, 210, 0.55)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          R
        </span>
        <input
          type="number"
          min={0}
          value={cost}
          onChange={(e) => setCost(Math.max(0, Number(e.target.value) || 0))}
          style={{
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
            width: 76,
            fontSize: 13,
            fontWeight: 700,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "rgba(255, 245, 230, 0.95)",
            fontFamily: "inherit",
            padding: "2px 0",
          }}
        />
      </div>
    </div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        background: "rgba(255, 184, 107, 0.10)",
        border: "1px solid rgba(255, 184, 107, 0.25)",
        color: "rgba(255, 245, 230, 0.85)",
      }}
    >
      {icon}
      {label}
    </span>
  );
}
