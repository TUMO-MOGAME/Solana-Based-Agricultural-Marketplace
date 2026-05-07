"use client";

// /grow-pack/new — Apply for a Grow Pack.
//
// Mockup reference: design/mockups/mobile.png screen 3 ("Plan next season").
// Form: crop, hectares, region, costs, threshold, max payout. Live quote
// preview matches `core/grow-pack.ts::quoteGrowPack` math.
//
// On submit:
//   1. Hash the farmer's identifier into a 32-byte ID
//   2. Build register_farmer + request_grow_pack instructions
//   3. Wrap them in one transaction so the farmer is registered atomically
//      with the pack request
//   4. Sign with the connected wallet (Phantom for demo / co-op staff)
//
// If the wallet isn't connected, the submit button prompts to connect.
// In demo mode (no Supabase), the submitter is the connected pubkey itself
// hashed as the farmer id — good enough for the hackathon.

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sprout, MapPin, Loader2 } from "lucide-react";
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
} from "@/lib/vuna/program";

// Default Grow Pack pricing — matches the proposal's 2-ha maize bundle.
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

export default function NewGrowPackPage() {
  const router = useRouter();
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
  const [success, setSuccess] = useState<{ sig: TransactionSignature; pack: string } | null>(null);

  // Live quote — same math the on-chain `request_grow_pack` will compute.
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

  // When the wallet connects, clear any stale "connect first" error.
  useEffect(() => {
    if (publicKey) setError(null);
  }, [publicKey]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!publicKey) {
      setError("Connect your wallet first to submit on-chain.");
      setWalletModalVisible(true);
      return;
    }

    setBusy(true);
    try {
      // Demo: hash the wallet pubkey itself as the farmer id. In production,
      // the cooperative onboards the farmer with structured PII first.
      const farmerIdHash = await farmerIdHashFrom(publicKey.toBase58());
      const [farmerAcc] = farmerPda(publicKey, farmerIdHash);
      const [packAcc] = packPda(farmerAcc, CURRENT_SEASON_ID);

      // Skip register_farmer if the FarmerAccount already exists on chain
      // (re-running register_farmer on an existing PDA fails in the
      // init-payer constraint).
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
      setSuccess({ sig, pack: packAcc.toBase58() });
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
      <main
        className="min-h-screen p-6 md:p-10"
        style={{
          background: "#1a0f0c",
          color: "rgba(255, 245, 230, 0.95)",
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        }}
      >
        <div className="max-w-md mx-auto">
          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(255, 184, 107, 0.10)",
              border: "1px solid rgba(255, 184, 107, 0.4)",
            }}
          >
            <div
              className="text-xs uppercase tracking-[0.18em] font-bold mb-2"
              style={{ color: "#ffb86b" }}
            >
              Submitted
            </div>
            <h1 className="text-2xl font-bold">Your Grow Pack request is on chain.</h1>
            <p className="text-sm mt-3" style={{ color: "rgba(255, 230, 210, 0.72)" }}>
              The cooperative reviews requests within 48 hours. You&apos;ll get
              a notification when your inputs are scheduled for delivery.
            </p>
            <dl
              className="mt-5 space-y-1 text-xs font-mono"
              style={{ color: "rgba(255, 230, 210, 0.55)" }}
            >
              <div className="flex justify-between gap-3">
                <dt>Pack</dt>
                <dd className="truncate max-w-[60%]">{success.pack}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Tx</dt>
                <dd className="truncate max-w-[60%]">{success.sig}</dd>
              </div>
            </dl>
            <div className="mt-5 flex gap-3">
              <Link
                href={`/insurance/${success.pack}`}
                className="rounded-full px-4 py-2 text-sm font-bold"
                style={{
                  background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                  color: "#1a0f0c",
                }}
              >
                View pack
              </Link>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-full px-4 py-2 text-sm font-bold"
                style={{
                  border: "1px solid rgba(255, 184, 107, 0.4)",
                  color: "rgba(255, 245, 230, 0.95)",
                }}
              >
                Back to dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const repayPreview = quote.totalRepayment;

  return (
    <main
      className="min-h-screen p-6 md:p-10"
      style={{
        background: "#1a0f0c",
        color: "rgba(255, 245, 230, 0.95)",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      }}
    >
      <div className="max-w-md mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs"
          style={{ color: "rgba(255, 230, 210, 0.55)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Plan next season</h1>
        <p className="text-sm" style={{ color: "rgba(255, 230, 210, 0.55)" }}>
          Tell us what you want to grow.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="CROP">
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="HECTARES">
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
            <Field label="REGION">
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

          {/* Bundle preview */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 230, 210, 0.14)",
            }}
          >
            <div
              className="text-[11px] font-bold uppercase tracking-[0.18em] mb-3"
              style={{ color: "#ffb86b" }}
            >
              Your Grow Pack
            </div>
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
              label="Drought insurance (parametric)"
              cost={insuranceCost}
              setCost={setInsuranceCost}
            />

            <div
              className="mt-4 pt-4 flex justify-between"
              style={{ borderTop: "1px solid rgba(255, 230, 210, 0.14)" }}
            >
              <span className="text-sm font-bold">Total today</span>
              <span className="text-sm font-bold tabular-nums">
                R {quote.bundleCost.toLocaleString("en-ZA")}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs" style={{ color: "rgba(255, 230, 210, 0.55)" }}>
              <span>Repay at harvest</span>
              <span className="font-bold tabular-nums" style={{ color: "#ffb86b" }}>
                ≈ R {repayPreview.toLocaleString("en-ZA")}
              </span>
            </div>
          </div>

          {error ? (
            <div
              className="rounded-xl px-4 py-3 text-xs"
              style={{
                background: "rgba(255, 123, 107, 0.10)",
                border: "1px solid rgba(255, 123, 107, 0.35)",
                color: "#ffb0a3",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || connecting}
            className="w-full rounded-full px-6 py-3.5 text-base font-bold inline-flex items-center justify-center gap-2 transition disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
              color: "#1a0f0c",
              boxShadow: "0 14px 32px rgba(255, 123, 107, 0.3)",
            }}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : !publicKey ? (
              "Connect wallet to apply"
            ) : (
              "Apply for this Grow Pack"
            )}
          </button>
          <p
            className="text-center text-[11px]"
            style={{ color: "rgba(255, 230, 210, 0.45)" }}
          >
            Your cooperative reviews requests within 48 hours.
          </p>
        </form>

        <FlavourChips crop={crop} hectares={hectares} regionLabel={REGIONS[region]?.label ?? ""} />
      </div>
    </main>
  );
}

const fieldInput: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.38)",
  border: "1px solid rgba(255, 230, 210, 0.14)",
  borderRadius: 10,
  padding: "10px 12px",
  color: "rgba(255, 245, 230, 0.95)",
  fontSize: 14,
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
    <label className="block">
      <span
        className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5"
        style={{ color: "rgba(255, 230, 210, 0.55)" }}
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
    <div className="flex items-center justify-between py-2 gap-3">
      <span className="text-sm" style={{ color: "rgba(255, 230, 210, 0.85)" }}>
        {label}
      </span>
      <div className="flex items-center gap-1">
        <span className="text-xs tabular-nums" style={{ color: "rgba(255, 230, 210, 0.55)" }}>
          R
        </span>
        <input
          type="number"
          min={0}
          value={cost}
          onChange={(e) => setCost(Math.max(0, Number(e.target.value) || 0))}
          className="text-right tabular-nums w-20 text-sm font-bold bg-transparent outline-none"
          style={{
            color: "rgba(255, 245, 230, 0.95)",
            border: "none",
          }}
        />
      </div>
    </div>
  );
}

function FlavourChips({
  crop,
  hectares,
  regionLabel,
}: {
  crop: string;
  hectares: string;
  regionLabel: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Chip icon={<Sprout className="w-3 h-3" />} label={`${crop} · ${hectares} ha`} />
      <Chip icon={<MapPin className="w-3 h-3" />} label={regionLabel} />
    </div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{
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
