// Mazra'at albaan — root landing page.
// Visual theme matches the dashboard / auth pages: dark-plum base
// (#1a0f0c), coral-amber gradient accent (#ff7b6b → #ffb86b), glass
// cards with translucent borders, warm cream text, Inter font.
// The colour tokens come from app/src/app/dashboard/dashboard.module.css.

import Link from "next/link";
import { Sprout, ShieldCheck, Wallet } from "lucide-react";

export default function WelcomePage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{
        background: "transparent",
        color: "rgba(255, 245, 230, 0.95)",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      }}
    >
      {/* Ambient coral / amber blobs — quiet brand tie-in to the auth pages */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full opacity-40 blur-[120px]"
        style={{ background: "radial-gradient(circle, #ff7b6b 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[34rem] w-[34rem] rounded-full opacity-30 blur-[140px]"
        style={{ background: "radial-gradient(circle, #ffb86b 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-6 md:px-12">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/brand/logo-mark.svg"
              alt="Mazra'at albaan"
              width={36}
              height={36}
              style={{
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
                display: "block",
              }}
            />
            <span
              className="text-lg font-bold tracking-tight"
              style={{ color: "rgba(255, 245, 230, 0.95)" }}
            >
              Mazra&apos;at albaan
            </span>
          </div>
          <nav className="flex items-center gap-3 text-sm md:gap-5">
            <Link
              href="/login"
              className="font-medium transition-opacity hover:opacity-80"
              style={{ color: "rgba(255, 230, 210, 0.72)" }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full px-4 py-2 text-sm font-bold transition hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                color: "#1a0f0c",
                boxShadow: "0 14px 32px rgba(255, 123, 107, 0.3)",
              }}
            >
              Get started
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="py-16 md:py-28">
          <p
            className="mb-5 text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: "#ffb86b" }}
          >
            Smarter farming · Fairer credit
          </p>
          <h1
            className="text-4xl font-bold leading-[1.05] tracking-tight md:text-7xl"
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
            className="mt-7 max-w-2xl text-base leading-relaxed md:text-lg"
            style={{ color: "rgba(255, 230, 210, 0.72)" }}
          >
            Mazra&apos;at albaan bundles certified seeds, fertilizer, and
            drought protection into a single package, delivered through your
            local farming cooperative and repaid at harvest. When bad weather
            hits, the insurance pays out automatically — no claim form, no
            waiting.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/grow-pack/new"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-bold transition hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                color: "#1a0f0c",
                boxShadow: "0 14px 32px rgba(255, 123, 107, 0.3)",
              }}
            >
              Apply for a Grow Pack
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border-2 px-6 py-3 text-base font-bold transition hover:bg-white/5"
              style={{
                borderColor: "rgba(255, 184, 107, 0.55)",
                color: "rgba(255, 245, 230, 0.95)",
              }}
            >
              I already have an account
            </Link>
          </div>
          <p
            className="mt-7 text-sm"
            style={{ color: "rgba(255, 230, 210, 0.5)" }}
          >
            Backed by your local extension office. Built in South Africa.
          </p>
        </section>

        {/* Feature row */}
        <section className="grid gap-5 pb-20 md:grid-cols-3">
          <Feature
            icon={<Sprout className="h-5 w-5" />}
            title="One Grow Pack"
            body="Certified seeds + fertilizer + insurance in one bundle. Approved by your cooperative in 48 hours."
          />
          <Feature
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Drought protection"
            body="If rainfall in your area falls below threshold, the policy pays out automatically. No paperwork, no claim form."
          />
          <Feature
            icon={<Wallet className="h-5 w-5" />}
            title="Repay at harvest"
            body="The cost is auto-deducted from your sale. Each successful season builds a portable credit history that follows you."
          />
        </section>

        <footer
          className="flex justify-between border-t pt-6 pb-8 text-xs"
          style={{
            borderColor: "rgba(255, 230, 210, 0.14)",
            color: "rgba(255, 230, 210, 0.5)",
          }}
        >
          <span>&copy; {new Date().getFullYear()} Mazra&apos;at albaan</span>
          <span>Tumo Mogame &amp; Pitsi Kgaume</span>
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
      className="rounded-2xl p-5 backdrop-blur"
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 230, 210, 0.14)",
      }}
    >
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          background: "rgba(255, 123, 107, 0.12)",
          color: "#ffb86b",
          border: "1px solid rgba(255, 184, 107, 0.25)",
        }}
      >
        {icon}
      </div>
      <h3
        className="font-bold"
        style={{ color: "rgba(255, 245, 230, 0.95)" }}
      >
        {title}
      </h3>
      <p
        className="mt-1.5 text-sm leading-relaxed"
        style={{ color: "rgba(255, 230, 210, 0.72)" }}
      >
        {body}
      </p>
    </div>
  );
}
