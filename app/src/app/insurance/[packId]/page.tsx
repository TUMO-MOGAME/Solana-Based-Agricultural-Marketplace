// /insurance/[packId] — standalone shareable drought-payout page.
//
// Server component — fetches the GrowPack from devnet at request time
// via the Borsh decoder in @/lib/vuna/program. Anyone can open the URL
// (no login, no wallet) and see the on-chain state.
//
// Visual theme matches the dashboard's embedded Insurance tab so the app
// feels one consistent piece across deep-links and in-app navigation.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import {
  fetchGrowPack,
  getConnection,
  type GrowPack,
} from "@/lib/vuna/program";

const ZAR_FORMATTER = new Intl.NumberFormat("en-ZA", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

function formatRand(amount: bigint | number): string {
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  return `R ${ZAR_FORMATTER.format(n)}`;
}

function shortPackId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

interface Props {
  params: Promise<{ packId: string }>;
}

export default async function InsurancePage({ params }: Props) {
  const { packId } = await params;

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(packId);
  } catch {
    return (
      <NotFoundShell reason="That pack address is not a valid Solana public key." />
    );
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
    return <NotFoundShell reason={`Network error reading the chain: ${error}`} />;
  }
  if (!pack) {
    return (
      <NotFoundShell reason="No Grow Pack at that address. Either the address is wrong or the account hasn't been created yet on this cluster." />
    );
  }

  const triggered =
    pack.status === "InsurancePaid" || pack.insurancePayout > 0n;
  const rainfall = pack.rainfallPercentOfNorm;
  const observedMm = Math.round((rainfall / 100) * 80);

  return (
    <Shell>
      <Header packId={packId} seasonId={pack.seasonId} />

      {/* Big payout banner */}
      <section
        style={{
          padding: 22,
          marginBottom: 14,
          borderRadius: 18,
          background:
            "linear-gradient(135deg, rgba(255, 184, 107, 0.18), rgba(255, 123, 107, 0.10))",
          border: "1px solid rgba(255, 184, 107, 0.45)",
          boxShadow: "0 14px 32px rgba(255, 123, 107, 0.18)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "#ffb86b",
            marginBottom: 6,
          }}
        >
          {triggered ? "Payout sent" : "No payout due"}
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            lineHeight: 1.05,
            background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {formatRand(pack.insurancePayout)}
        </div>
        <p
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "rgba(255, 245, 230, 0.92)",
          }}
        >
          {triggered ? (
            <>Sent to your account. <span style={{ color: "rgba(255, 230, 210, 0.55)" }}>No paperwork. No claim form.</span></>
          ) : (
            <>Threshold not breached. <span style={{ color: "rgba(255, 230, 210, 0.55)" }}>Cover remains active.</span></>
          )}
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 14,
        }}
        className="insurance-grid"
      >
        {/* Why you were paid */}
        <Card>
          <CardHeader
            title={triggered ? "Why you were paid" : "Rainfall observation"}
            label={`${rainfall}%`}
          />
          <div style={{ fontSize: 13, color: "rgba(255, 230, 210, 0.72)", marginBottom: 4 }}>
            Rainfall in your area
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: "rgba(255, 245, 230, 0.95)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {rainfall}%
            </span>
            <span style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.55)" }}>
              of 100% norm (≈ {observedMm}mm of 80mm)
            </span>
          </div>
          <RainfallBars
            rainfallPercent={rainfall}
            thresholdPercent={pack.thresholdPercent}
          />
        </Card>

        {/* Pack details */}
        <Card>
          <CardHeader title="Pack details" label={pack.status} />
          <DetailRow label="Bundle cost" value={formatRand(pack.bundleCost)} />
          <DetailRow label="Service fee" value={formatRand(pack.serviceFee)} />
          <DetailRow label="Total repayment" value={formatRand(pack.totalRepayment)} />
          <DetailRow label="Threshold" value={`${pack.thresholdPercent}% of norm`} />
          <DetailRow label="Max payout" value={formatRand(pack.maxPayout)} />
          <DetailRow
            label="Insurance payout"
            value={formatRand(pack.insurancePayout)}
            highlight
          />
          <DetailRow label="Pack" value={shortPackId(packId)} mono />
        </Card>
      </div>

      {/* Reassurance */}
      <section
        style={{
          padding: 16,
          borderRadius: 14,
          background: "rgba(46, 125, 50, 0.10)",
          border: "1px solid rgba(46, 125, 50, 0.35)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(255, 245, 230, 0.95)",
          }}
        >
          Your Grow Pack is still active.
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255, 230, 210, 0.72)",
            marginTop: 4,
          }}
        >
          Talk to your co-op about replanting options.
        </div>
      </section>
    </Shell>
  );
}

// ============================================================================
//  Layout primitives — match the dashboard's dark-plum / coral-amber palette
// ============================================================================

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100svh",
        background: "transparent",
        color: "rgba(255, 245, 230, 0.95)",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        padding: "20px 16px 32px",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          top: -160,
          left: -160,
          width: 480,
          height: 480,
          borderRadius: "50%",
          opacity: 0.28,
          filter: "blur(120px)",
          background: "radial-gradient(circle, #ff7b6b 0%, transparent 70%)",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          bottom: -200,
          right: -180,
          width: 560,
          height: 560,
          borderRadius: "50%",
          opacity: 0.20,
          filter: "blur(140px)",
          background: "radial-gradient(circle, #ffb86b 0%, transparent 70%)",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto" }}>
        {children}
      </div>
    </main>
  );
}

function Header({ packId, seasonId }: { packId: string; seasonId: number }) {
  return (
    <header style={{ marginBottom: 18 }}>
      <Link
        href="/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: "rgba(255, 230, 210, 0.55)",
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={14} />
        Dashboard
      </Link>
      <h1
        style={{
          marginTop: 12,
          fontSize: 22,
          fontWeight: 800,
          color: "rgba(255, 245, 230, 0.95)",
          letterSpacing: "-0.3px",
        }}
      >
        Drought protection
      </h1>
      <p
        style={{
          marginTop: 4,
          fontSize: 11,
          color: "rgba(255, 230, 210, 0.55)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        }}
      >
        Pack {shortPackId(packId)} · Season {seasonId}
      </p>
    </header>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: 18,
        borderRadius: 16,
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 230, 210, 0.14)",
        backdropFilter: "blur(8px)",
      }}
    >
      {children}
    </section>
  );
}

function CardHeader({ title, label }: { title: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <h2
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "rgba(255, 245, 230, 0.95)",
          margin: 0,
          letterSpacing: "-0.1px",
        }}
      >
        {title}
      </h2>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "rgba(255, 230, 210, 0.55)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid rgba(255, 230, 210, 0.06)",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 12, color: "rgba(255, 230, 210, 0.55)" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: highlight ? 14 : 13,
          fontWeight: highlight ? 800 : 600,
          color: highlight ? "#ffb86b" : "rgba(255, 245, 230, 0.92)",
          fontVariantNumeric: "tabular-nums",
          fontFamily: mono
            ? "var(--font-geist-mono), ui-monospace, monospace"
            : "inherit",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function RainfallBars({
  rainfallPercent,
  thresholdPercent,
}: {
  rainfallPercent: number;
  thresholdPercent: number;
}) {
  const weeks = 6;
  const barFraction = rainfallPercent / weeks;
  const max = 30;
  const thresholdY = thresholdPercent / weeks;
  return (
    <div
      style={{
        position: "relative",
        height: 92,
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        padding: "0 28px 0 4px",
        marginTop: 4,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 4,
          right: 28,
          bottom: `${(thresholdY / max) * 100}%`,
          borderTop: "2px dashed #C0392B",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 0,
          bottom: `${(thresholdY / max) * 100}%`,
          transform: "translateY(-50%)",
          fontSize: 9,
          fontWeight: 800,
          color: "#C0392B",
          letterSpacing: "0.06em",
        }}
      >
        min
      </span>
      {Array.from({ length: weeks }).map((_, i) => {
        const heightPct = Math.min(100, (barFraction / max) * 100);
        const belowThreshold = barFraction < thresholdY;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              height: "100%",
            }}
          >
            <div
              style={{
                width: "100%",
                marginTop: "auto",
                height: `${heightPct}%`,
                borderRadius: 3,
                background: belowThreshold ? "#E67E22" : "#2E7D32",
                boxShadow: belowThreshold
                  ? "0 0 12px rgba(230, 126, 34, 0.35)"
                  : "none",
              }}
            />
            <div
              style={{
                fontSize: 9,
                color: "rgba(255, 230, 210, 0.4)",
                marginTop: 4,
              }}
            >
              W{i + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotFoundShell({ reason }: { reason: string }) {
  return (
    <Shell>
      <Link
        href="/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: "rgba(255, 230, 210, 0.55)",
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={14} />
        Dashboard
      </Link>
      <Card>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "rgba(255, 245, 230, 0.95)",
            marginTop: 4,
          }}
        >
          Pack not found
        </h1>
        <p
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "rgba(255, 230, 210, 0.55)",
            lineHeight: 1.5,
          }}
        >
          {reason}
        </p>
      </Card>
    </Shell>
  );
}
