"use client";

import { useEffect, useState } from "react";
import { Cinzel, Manrope } from "next/font/google";
import Link from "next/link";
import styles from "./welcome.module.css";

// Welcome-page-only fonts. The rest of the app continues to use Satoshi.
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

export default function WelcomePage() {
  // Ticket header year (A/W <year>) and the Date / Time blocks reflect
  // the live moment — `now` is a state value that ticks once a minute so
  // the time block stays current without a reload. Time is rendered in
  // SAST (Africa/Johannesburg) regardless of the visitor's device.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const year = now.getFullYear();
  const ticketDate = now
    .toLocaleDateString("en-US", { month: "long", day: "numeric" })
    .toUpperCase();
  const ticketTime = now.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Johannesburg",
  });

  return (
    <div
      className={`${styles.wrapper} ${cinzel.variable} ${manrope.variable}`}
      style={{ fontFamily: "var(--font-manrope), 'Manrope', sans-serif" }}
    >
      <div className={styles.ambientLight} />

      {/* Top-right nav — always visible, doesn't compete with the ticket */}
      <nav className={styles.topNav}>
        <Link href="/about" className={styles.topNavLink}>About</Link>
        <span className={styles.topNavDivider} aria-hidden="true" />
        <Link href="/trends" className={styles.topNavLink}>Trends</Link>
        <span className={styles.topNavDivider} aria-hidden="true" />
        <Link href="/team" className={styles.topNavLink}>Team</Link>
      </nav>

      {/* Animated CTA arrows pointing at the ticket. Anticlockwise arcs
          (top arc bows up over and down to the left, bottom arc bows
          down under and up to the right) draw themselves in, hold, then
          fade — alternating so one is always animating. Pure SVG +
          CSS, decorative only (aria-hidden, pointer-events: none). */}
      <div
        className={`${styles.cueArrow} ${styles.cueArrowTop}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 220 100" xmlns="http://www.w3.org/2000/svg">
          <path
            className={styles.cueArrowPath}
            d="M200 80 Q 110 0 20 80 L 31.7 77.6 L 20 80 L 23.8 68.6"
            pathLength="100"
            fill="none"
          />
          <text
            className={styles.cueArrowText}
            x="110"
            y="14"
            textAnchor="middle"
          >
            click here
          </text>
        </svg>
      </div>

      {/*
        <Link> instead of router.push gives us automatic prefetch:
        Next.js loads the /login CSS + JS as soon as the ticket enters the
        viewport, so the click-through renders without FOUC.
      */}
      <Link
        href="/login"
        className={styles.ticketContainer}
        aria-label="Enter Social Assembly"
      >
        <article className={styles.ticketMain}>
          <div className={styles.ticketContent}>
            <header className={styles.ticketHeader}>
              <span suppressHydrationWarning>A/W {year}</span>
              <span className={styles.serial}>No. 004912</span>
            </header>

            <div>
              <h1 className={styles.title}>
                SOCIAL
                <br />
                ASSEMBLY
              </h1>
              <p className={styles.subtitle}>Emma Matlhaga</p>
            </div>

            <footer className={styles.ticketFooter}>
              <div className={styles.infoBlock}>
                <span className={styles.label}>Date</span>
                <span className={styles.value} suppressHydrationWarning>
                  {ticketDate}
                </span>
              </div>
              <div className={styles.infoBlock}>
                <span className={styles.label}>Time</span>
                <span className={styles.value} suppressHydrationWarning>
                  {ticketTime}
                </span>
              </div>
              <div className={styles.infoBlock}>
                <span className={styles.label}>Admit</span>
                <span className={styles.value}>TWO</span>
              </div>
            </footer>
          </div>

          <div className={styles.perforationLine} />
        </article>

        <aside className={styles.ticketStub}>
          <div className={styles.foilSeal} />
          <div className={styles.barcode} />
          <p className={styles.stubText}>VIP ACCESS</p>
        </aside>
      </Link>

      {/* Bottom CTA arrow — anticlockwise arc bowing under the ticket */}
      <div
        className={`${styles.cueArrow} ${styles.cueArrowBottom}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 220 100" xmlns="http://www.w3.org/2000/svg">
          <path
            className={styles.cueArrowPath}
            d="M20 20 Q 110 100 200 20 L 188.3 22.4 L 200 20 L 196.2 31.4"
            pathLength="100"
            fill="none"
          />
          <text
            className={styles.cueArrowText}
            x="110"
            y="90"
            textAnchor="middle"
          >
            click here
          </text>
        </svg>
      </div>
    </div>
  );
}
