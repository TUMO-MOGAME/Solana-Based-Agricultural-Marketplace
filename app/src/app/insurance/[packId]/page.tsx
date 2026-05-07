// /insurance/[packId] — drought-payout screen.
//
// Reads a GrowPack PDA from devnet via @core/lib/vuna/program and renders
// the rainfall + payout view from design/mockups/mobile.png screen 4.
//
// This is a SERVER component — it runs on the Next.js server, fetches the
// account, and ships the rendered HTML. No wallet, no signing, just read.

import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { fetchGrowPack, getConnection, type GrowPack } from "@/lib/vuna/program";

const ZAR_FORMATTER = new Intl.NumberFormat("en-ZA", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

function formatRand(amount: bigint | number): string {
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  return `R ${ZAR_FORMATTER.format(n)}`;
}

interface Props {
  params: Promise<{ packId: string }>;
}

export default async function InsurancePage({ params }: Props) {
  const { packId } = await params;

  // Validate the URL param is a real Solana address.
  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(packId);
  } catch {
    return <NotFoundCard reason="That pack address is not a valid Solana public key." />;
  }

  const connection = getConnection();
  let pack: GrowPack | null = null;
  let error: string | null = null;
  try {
    pack = await fetchGrowPack(connection, pubkey);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error) {
    return (
      <NotFoundCard reason={`Network error reading the chain: ${error}`} />
    );
  }
  if (!pack) {
    return <NotFoundCard reason="No Grow Pack at that address. Either the address is wrong or the account hasn't been created yet on this cluster." />;
  }

  const triggered =
    pack.status === "InsurancePaid" || pack.insurancePayout > 0n;
  const rainfall = pack.rainfallPercentOfNorm;
  const expectedRainfallNorm = 100; // % of norm — display only
  const observedRainfallEquivalentMm = Math.round((rainfall / 100) * 80);

  return (
    <main className="min-h-screen bg-[#F5F2EA] text-[#1A1A1A] p-4 md:p-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <header className="mb-6">
          <Link
            href="/dashboard"
            className="text-xs text-[#666666] hover:text-[#1A1A1A]"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-[#0B3D2E]">
            Drought protection
          </h1>
          <p className="text-xs text-[#666666] mt-1">
            Pack <code className="text-[10px]">{shortAddress(packId)}</code>
            <span className="mx-2">·</span>
            Season {pack.seasonId}
          </p>
        </header>

        {/* Payout banner */}
        {triggered ? (
          <section
            className="rounded-2xl p-5 mb-5"
            style={{
              backgroundColor: "#FAEBC3",
              border: "2px solid #E8B931",
            }}
          >
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#E67E22]">
              Payout sent
            </div>
            <div className="text-4xl font-bold text-[#1A1A1A] mt-2">
              {formatRand(pack.insurancePayout)}
            </div>
            <p className="mt-2 text-sm font-bold text-[#1A1A1A]">
              Sent to your account.
            </p>
            <p className="text-xs text-[#666666]">
              No paperwork. No claim form.
            </p>
          </section>
        ) : (
          <section className="rounded-2xl p-5 mb-5 bg-white border border-[#E5E0D5]">
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#1F6B49]">
              No payout due
            </div>
            <div className="text-2xl font-bold text-[#0B3D2E] mt-2">
              Rainfall normal
            </div>
            <p className="mt-1 text-xs text-[#666666]">
              Threshold not breached. Cover remains active.
            </p>
          </section>
        )}

        {/* Why card */}
        <section className="rounded-2xl bg-white border border-[#E5E0D5] p-5 mb-5">
          <div className="text-[11px] uppercase tracking-wider font-bold text-[#666666]">
            {triggered ? "Why you were paid" : "Rainfall observation"}
          </div>
          <div className="mt-3 text-sm text-[#1A1A1A]">
            Rainfall in your area
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#1A1A1A] tabular-nums">
              {rainfall}%
            </span>
            <span className="text-xs text-[#666666]">
              of {expectedRainfallNorm}% norm (≈ {observedRainfallEquivalentMm}mm of 80mm)
            </span>
          </div>

          {/* Bar chart — quick illustrative split, scaled to threshold */}
          <RainfallBarChart
            rainfallPercent={rainfall}
            thresholdPercent={pack.thresholdPercent}
          />
        </section>

        {/* Footer reassurance */}
        <section
          className="rounded-2xl p-4 mb-5"
          style={{ backgroundColor: "#E0EAE2" }}
        >
          <div className="text-sm font-bold text-[#0B3D2E]">
            Your Grow Pack is still active.
          </div>
          <div className="text-xs text-[#1F6B49] mt-1">
            Talk to your co-op about replanting options.
          </div>
        </section>

        {/* Pack details */}
        <details className="mt-6 text-xs text-[#666666]">
          <summary className="cursor-pointer hover:text-[#1A1A1A]">
            Pack details
          </summary>
          <dl className="mt-3 space-y-1 font-mono text-[11px]">
            <Row label="Status" value={pack.status} />
            <Row
              label="Bundle cost"
              value={formatRand(pack.bundleCost)}
            />
            <Row
              label="Service fee"
              value={formatRand(pack.serviceFee)}
            />
            <Row
              label="Total repayment"
              value={formatRand(pack.totalRepayment)}
            />
            <Row
              label="Threshold"
              value={`${pack.thresholdPercent}% of norm`}
            />
            <Row
              label="Max payout"
              value={formatRand(pack.maxPayout)}
            />
            <Row
              label="Insurance payout"
              value={formatRand(pack.insurancePayout)}
            />
          </dl>
        </details>
      </div>
    </main>
  );
}

function NotFoundCard({ reason }: { reason: string }) {
  return (
    <main className="min-h-screen bg-[#F5F2EA] text-[#1A1A1A] p-4 md:p-8">
      <div className="max-w-md mx-auto">
        <Link
          href="/dashboard"
          className="text-xs text-[#666666] hover:text-[#1A1A1A]"
        >
          ← Dashboard
        </Link>
        <div className="mt-6 rounded-2xl bg-white border border-[#E5E0D5] p-6">
          <h1 className="text-xl font-bold text-[#0B3D2E]">
            Pack not found
          </h1>
          <p className="mt-2 text-sm text-[#666666]">{reason}</p>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#A5A096]">{label}</dt>
      <dd className="text-[#1A1A1A]">{value}</dd>
    </div>
  );
}

function RainfallBarChart({
  rainfallPercent,
  thresholdPercent,
}: {
  rainfallPercent: number;
  thresholdPercent: number;
}) {
  // Six synthetic week buckets. We don't have weekly data on-chain — the
  // chain only stores the season aggregate — so each bar is a smoothed
  // segment of the cumulative rainfall, distributed roughly evenly. This
  // matches the *visual* of the mockup; once we have a per-week oracle
  // feed off-chain, we can replace this with real per-week values.
  const weeks = 6;
  const barFraction = rainfallPercent / weeks; // each bar is 1/6 of total
  const bars = Array.from({ length: weeks }, (_, i) => ({
    label: `W${i + 1}`,
    value: barFraction,
  }));

  const max = 30; // visual ceiling, in % units
  const thresholdY = thresholdPercent / weeks; // dashed line position
  return (
    <div className="mt-5 relative h-24 flex items-end gap-2 pl-1 pr-8">
      {/* threshold dashed line */}
      <div
        aria-hidden
        className="absolute left-1 right-8 border-t-2 border-dashed border-[#C0392B]"
        style={{ bottom: `${(thresholdY / max) * 100}%` }}
      />
      <span
        aria-hidden
        className="absolute right-0 text-[9px] font-bold text-[#C0392B]"
        style={{ bottom: `${(thresholdY / max) * 100}%`, transform: "translateY(-50%)" }}
      >
        min
      </span>
      {bars.map((b, i) => {
        const heightPct = Math.min(100, (b.value / max) * 100);
        const belowThreshold = b.value < thresholdY;
        return (
          <div
            key={b.label}
            className="flex-1 flex flex-col items-center justify-end h-full"
          >
            <div
              className="w-full rounded-sm"
              style={{
                height: `${heightPct}%`,
                backgroundColor: belowThreshold ? "#E67E22" : "#2E7D32",
              }}
            />
            <div className="text-[10px] text-[#A5A096] mt-1">{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function shortAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
