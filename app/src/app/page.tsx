// Mazra'at albaan — root landing page.
// Visual theme matches the dashboard / auth pages: dark-plum base
// (#1a0f0c), coral-amber gradient accent (#ff7b6b → #ffb86b), glass
// cards with translucent borders, warm cream text, Inter font.

import Link from "next/link";
import { Sprout, ShieldCheck, Wallet } from "lucide-react";

export default function WelcomePage() {
  return (
    <main
      className="relative h-screen w-screen overflow-hidden flex flex-col"
      style={{
        background: "transparent",
        color: "rgba(255, 245, 230, 0.95)",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      }}
    >
      {/* Ambient coral / amber blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[26rem] w-[26rem] rounded-full opacity-35 blur-[120px]"
        style={{ background: "radial-gradient(circle, #ff7b6b 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-[30rem] w-[30rem] rounded-full opacity-25 blur-[140px]"
        style={{ background: "radial-gradient(circle, #ffb86b 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col px-6 py-4 md:px-10 md:py-5">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/logo-mark.svg"
              alt="Mazra'at albaan"
              width={32}
              height={32}
              style={{
                borderRadius: 10,
                boxShadow: "0 6px 18px rgba(0, 0, 0, 0.35)",
                display: "block",
              }}
            />
            <span
              className="text-base font-bold tracking-tight"
              style={{ color: "rgba(255, 245, 230, 0.95)" }}
            >
              Mazra&apos;at albaan
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/login"
              className="font-medium transition-opacity hover:opacity-80"
              style={{ color: "rgba(255, 230, 210, 0.72)" }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                color: "#1a0f0c",
                boxShadow: "0 8px 20px rgba(255, 123, 107, 0.25)",
              }}
            >
              Get started
            </Link>
          </nav>
        </header>

        {/* Main — two-column hero with cards-aside */}
        <section className="grid flex-1 items-center gap-8 py-4 md:grid-cols-12 md:gap-10 md:py-6">
          {/* Hero copy */}
          <div className="md:col-span-7">
            <p
              className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em]"
              style={{ color: "#ffb86b" }}
            >
              Smarter farming · Fairer credit
            </p>
            <h1
              className="text-3xl font-bold leading-[1.05] tracking-tight md:text-5xl"
              style={{
                background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              A Grow Pack,
              <br />
              an insured harvest,
              <br />
              a fair price.
            </h1>
            <p
              className="mt-4 max-w-xl text-sm leading-relaxed md:text-[15px]"
              style={{ color: "rgba(255, 230, 210, 0.72)" }}
            >
              Mazra&apos;at albaan bundles certified seeds, fertilizer, and
              drought protection into one package — delivered through your local
              cooperative, repaid at harvest. When bad weather hits, the
              insurance pays out automatically.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/grow-pack/new"
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                  color: "#1a0f0c",
                  boxShadow: "0 10px 24px rgba(255, 123, 107, 0.28)",
                }}
              >
                Apply for a Grow Pack
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition hover:bg-white/5"
                style={{
                  borderColor: "rgba(255, 184, 107, 0.45)",
                  color: "rgba(255, 245, 230, 0.95)",
                }}
              >
                I already have an account
              </Link>
            </div>
            <p
              className="mt-4 text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "rgba(255, 230, 210, 0.45)" }}
            >
              Backed by your local extension office · Built in South Africa
            </p>
          </div>

          {/* Feature cards — stacked rows */}
          <div className="flex flex-col gap-3 md:col-span-5">
            <Feature
              icon={<Sprout className="h-4 w-4" />}
              title="One Grow Pack"
              body="Certified seeds, fertilizer, and insurance in one bundle. Approved in 48 hours."
            />
            <Feature
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Drought protection"
              body="Below-threshold rainfall triggers an automatic payout. No claim form."
            />
            <Feature
              icon={<Wallet className="h-4 w-4" />}
              title="Repay at harvest"
              body="Auto-deducted from your sale. Every season builds portable credit."
            />
          </div>
        </section>

        <footer
          className="flex items-center justify-between border-t pt-3 text-[11px]"
          style={{
            borderColor: "rgba(255, 230, 210, 0.12)",
            color: "rgba(255, 230, 210, 0.45)",
          }}
        >
          <span>&copy; {new Date().getFullYear()} Mazra&apos;at albaan</span>
          <span>Tumo Mogame</span>
        </footer>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl p-3.5 backdrop-blur"
      style={{
        background: "rgba(255, 255, 255, 0.035)",
        border: "1px solid rgba(255, 230, 210, 0.12)",
      }}
    >
      <div
        className="flex h-8 w-8 flex-none items-center justify-center rounded-lg"
        style={{
          background: "rgba(255, 123, 107, 0.12)",
          color: "#ffb86b",
          border: "1px solid rgba(255, 184, 107, 0.22)",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h3
          className="text-sm font-semibold leading-tight"
          style={{ color: "rgba(255, 245, 230, 0.95)" }}
        >
          {title}
        </h3>
        <p
          className="mt-1 text-xs leading-relaxed"
          style={{ color: "rgba(255, 230, 210, 0.68)" }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}
