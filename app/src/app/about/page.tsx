import type { Metadata } from "next";
import Link from "next/link";
import { Cinzel, Manrope } from "next/font/google";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "About — Social Assembly",
  description:
    "Social Assembly is an AI-powered growth platform built for South African content creators.",
};

// Same pairing as the landing page — keep the three public pages consistent.
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-manrope",
  display: "swap",
});

/* ── Content ──────────────────────────────────────────────────────────
   High-level public copy only. Internal IP from the tech deep-dive
   (model names, moat terminology, the identity model) stays private.
   ────────────────────────────────────────────────────────────────── */

const PILLARS = [
  {
    title: "Pre-publish coaching",
    body: "Upload a video before you post it and get a second-by-second report on hooks, pacing, audio, and where attention drops. Fix it, then ship.",
  },
  {
    title: "Hyper-local trend radar",
    body: "Trends don't start nationally — they start in a suburb. We surface what's working in your niche in your city before the rest of the internet catches up.",
  },
  {
    title: "Trajectory over vanity",
    body: "Follower counts don't tell you where you're going. Our score tracks your direction of travel so you can see progress that actually compounds.",
  },
  {
    title: "Built for South Africa",
    body: "SA content has its own humour, its own references, its own community. Every recommendation we make is tuned for the audience you're actually making for.",
  },
];

export default function AboutPage() {
  return (
    <main className={`${cinzel.variable} ${manrope.variable} ${styles.wrapper}`}>
      <div className={styles.ambientLight} aria-hidden="true" />
      <div className={styles.container}>
        <Link href="/" className={styles.back}>
          <ArrowLeft size={14} /> Back
        </Link>

        <p className={styles.eyebrow}>About Social Assembly</p>
        <h1 className={styles.hero}>
          A better way for creators to grow.
        </h1>
        <p className={styles.lede}>
          Social Assembly is an AI-powered growth platform built for South
          African content creators. Honest feedback before you post, trend
          intelligence from your own city, and a clear roadmap from where you
          are to where you want to be.
        </p>

        {/* ── Why we built it ── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>Why we built it</p>
          <h2 className={styles.sectionTitle}>
            Creator growth shouldn&apos;t be guesswork.
          </h2>
          <p className={styles.sectionBody}>
            Most creators post, wait, and hope. The ones who grow fast have
            something the rest don&apos;t: a coach who watches their content
            before it goes live and tells them exactly what to fix.
          </p>
          <p className={styles.sectionBody}>
            Social Assembly is that coach, built into a platform. You get the
            kind of feedback that used to be reserved for creators signed to
            agencies — on every video, every time.
          </p>
        </section>

        {/* ── Pillars ── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>What you get</p>
          <h2 className={styles.sectionTitle}>Four things, done properly.</h2>
          <div className={styles.pillars}>
            {PILLARS.map((p) => (
              <div key={p.title} className={styles.pillar}>
                <h3 className={styles.pillarTitle}>{p.title}</h3>
                <p className={styles.pillarBody}>{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Philosophy ── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>How it learns</p>
          <h2 className={styles.sectionTitle}>
            The more you use it, the smarter it gets about you.
          </h2>
          <p className={styles.sectionBody}>
            Every time you upload a video, engage with a trending insight, or
            act on a suggestion, the system learns something about how you
            create. Over time the coaching stops being generic and starts
            feeling like it was written for you specifically — because it was.
          </p>
          <p className={styles.sectionBody}>
            We&apos;re not interested in telling creators what worked for
            someone else. We&apos;re interested in what works for{" "}
            <strong>you</strong>, in your city, in your niche, right now.
          </p>
        </section>

        {/* ── The team teaser ── */}
        <div className={styles.teamCta}>
          <p className={styles.teamCtaText}>
            Three people. One mission. Meet the team behind Social Assembly.
          </p>
          <Link href="/team" className={styles.teamCtaLink}>
            The team <ArrowUpRight size={14} />
          </Link>
        </div>

        <footer className={styles.footer}>
          Social Assembly · Made in South Africa
        </footer>
      </div>
    </main>
  );
}
