"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "./trends.module.css";

/* Slide data — 1 intro + 12 monthly entries. Background image numbers
   reference picsum.photos `?random=N` seeds; swap to /trends/<month>.jpg
   once real photography is shot. */
type Slide =
  | { kind: "intro"; title: string; subtitle: string; image: number }
  | { kind: "month"; month: string; event: string; image: number };

const SLIDES: Slide[] = [
  {
    kind: "intro",
    title: "What is trending in 2025",
    subtitle: "Based on Google Trends",
    image: 100,
  },
  {
    kind: "month",
    month: "January",
    event: "AI tools and chatbots dominate early 2025 searches",
    image: 1,
  },
  {
    kind: "month",
    month: "February",
    event: "Political protests & civic engagement spike globally",
    image: 2,
  },
  {
    kind: "month",
    month: "March",
    event: "Tech launches and generative AI models trend online",
    image: 3,
  },
  {
    kind: "month",
    month: "April",
    event: "AI productivity & generative media searches surge",
    image: 4,
  },
  {
    kind: "month",
    month: "May",
    event: "AI assistants integrated in devices capture attention",
    image: 5,
  },
  {
    kind: "month",
    month: "June",
    event: "Vintage fashion & lifestyle trends dominate search",
    image: 6,
  },
  {
    kind: "month",
    month: "July",
    event: "Martha Stewart aesthetic & intentional living trend",
    image: 7,
  },
  {
    kind: "month",
    month: "August",
    event: "Indonesian nationwide demonstrations trend globally",
    image: 8,
  },
  {
    kind: "month",
    month: "September",
    event: "Generative AI apps & personal assistant searches spike",
    image: 9,
  },
  {
    kind: "month",
    month: "October",
    event: "October becomes top month for weddings in the US",
    image: 10,
  },
  {
    kind: "month",
    month: "November",
    event: "FIFA Club World Cup & sports searches spike",
    image: 11,
  },
  {
    kind: "month",
    month: "December",
    event: "Viral challenges & film box-office battles trend",
    image: 12,
  },
];

const cx = (...parts: Array<string | false | undefined>) =>
  parts.filter(Boolean).join(" ");

export default function TrendsView({ fontVar }: { fontVar: string }) {
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [bumped, setBumped] = useState<"prev" | "next" | null>(null);

  // Re-trigger the title/subtitle scale-in + slide-up on every slide change.
  useEffect(() => {
    setAnimating(false);
    const t = setTimeout(() => setAnimating(true), 50);
    return () => clearTimeout(t);
  }, [index]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % SLIDES.length);
    setBumped("next");
  }, []);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);
    setBumped("prev");
  }, []);

  // Clear the yellow button-bump after 200ms — matches the reference timing.
  useEffect(() => {
    if (!bumped) return;
    const t = setTimeout(() => setBumped(null), 200);
    return () => clearTimeout(t);
  }, [bumped]);

  // Keyboard nav — Arrow Up/Down + Page Up/Down.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "PageUp") {
        e.preventDefault();
        prev();
      }
      if (e.code === "ArrowDown" || e.code === "PageDown") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  return (
    <main className={cx(fontVar, styles.wrapper)}>
      <Link href="/" className={styles.back}>
        <ArrowLeft size={14} /> Back
      </Link>

      {SLIDES.map((slide, i) => {
        const isActive = i === index;
        return (
          <div
            key={i}
            className={cx(
              styles.slide,
              isActive && styles.active,
              isActive && animating && styles.animate
            )}
            style={{
              backgroundImage: `url(https://picsum.photos/1920/1080?random=${slide.image})`,
            }}
            aria-hidden={!isActive}
          >
            <div className={styles.overlay} />
            {slide.kind === "intro" ? (
              <>
                <div className={styles.title}>{slide.title}</div>
                <div className={styles.subtitle}>{slide.subtitle}</div>
              </>
            ) : (
              <>
                <div className={styles.month}>{slide.month}</div>
                <div className={styles.event}>{slide.event}</div>
              </>
            )}
          </div>
        );
      })}

      <div className={styles.nav}>
        <button
          type="button"
          className={cx(styles.navBtn, bumped === "prev" && styles.bump)}
          onClick={prev}
          aria-label="Previous trend"
        >
          ▲
        </button>
        <button
          type="button"
          className={cx(styles.navBtn, bumped === "next" && styles.bump)}
          onClick={next}
          aria-label="Next trend"
        >
          ▼
        </button>
      </div>

      <p className={styles.counter}>
        {String(index + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
      </p>
    </main>
  );
}
