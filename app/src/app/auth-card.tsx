"use client";

import { ReactNode, useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./auth.module.css";

// Inter comes from next/font/google in the root layout (--font-inter).
// That guarantees the font is preloaded on every route, so navigating
// to /login or /signup never shows a FOUT flash.

interface AuthCardProps {
  /** Title words rendered as stacked spans (e.g. ["Welcome", "Back"]) */
  titleWords: string[];
  subtitle: string;
  /** Two-letter watermark shown behind the content. */
  watermark: string;
  children: ReactNode;
  /** Footer block (e.g. "New here? Create an account"). */
  footer?: ReactNode;
}

export default function AuthCard({
  titleWords,
  subtitle,
  watermark,
  children,
  footer,
}: AuthCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const splashRef = useRef<HTMLDivElement>(null);
  const watermarkRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;

    // Entry — CSS hides the card + title spans initially (opacity:0, y offset),
    // so we animate *toward* the visible state. No flash on first paint.
    gsap.to(cardRef.current, {
      y: 0,
      opacity: 1,
      duration: 1.2,
      ease: "power4.out",
    });

    if (titleRef.current) {
      gsap.to(titleRef.current.querySelectorAll("span"), {
        y: 0,
        opacity: 1,
        stagger: 0.12,
        delay: 0.3,
        duration: 1,
        ease: "power4.out",
      });
    }

    // Icon stroke-draw — each field icon fades in by drawing its outline
    if (cardRef.current) {
      const icons = cardRef.current.querySelectorAll("svg[data-auth-icon]");
      if (icons.length > 0) {
        gsap.to(icons, {
          strokeDashoffset: 0,
          duration: 1.2,
          stagger: 0.18,
          delay: 0.9,
          ease: "power2.out",
        });
      }
    }

    // Drifts (infinite yoyo)
    const watermarkTween = watermarkRef.current
      ? gsap.to(watermarkRef.current, {
          y: -20,
          x: 10,
          duration: 10,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
      : null;

    const splashTween = splashRef.current
      ? gsap.to(splashRef.current, {
          x: 20,
          y: 20,
          scale: 1.1,
          duration: 12,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
      : null;

    // Magnetic interaction — desktop only. Skip on touch pointers so the
    // card doesn't jitter when tapping into a form field.
    const isCoarsePointer =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;

    const card = cardRef.current;
    let onMove: ((e: MouseEvent) => void) | null = null;
    let onLeave: (() => void) | null = null;

    if (!isCoarsePointer && card) {
      onMove = (e: MouseEvent) => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        gsap.to(card, {
          x: x * 0.05,
          y: y * 0.05,
          rotateX: -y * 0.02,
          rotateY: x * 0.02,
          duration: 0.6,
          ease: "power3.out",
        });
      };
      onLeave = () => {
        gsap.to(card, {
          x: 0,
          y: 0,
          rotateX: 0,
          rotateY: 0,
          duration: 0.8,
          ease: "power4.out",
        });
      };
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", onLeave);
    }

    return () => {
      watermarkTween?.kill();
      splashTween?.kill();
      if (onMove) card?.removeEventListener("mousemove", onMove);
      if (onLeave) card?.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      className={styles.wrapper}
      style={{
        perspective: "1200px",
        fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
      }}
    >
      {/* Ambient background blobs */}
      <div className={styles.bg} />

      {/* Inline SVG gradient reference used by any stroke="url(#auth-accent-gradient)" */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="auth-accent-gradient">
            <stop offset="0%" stopColor="#ff7b6b" />
            <stop offset="100%" stopColor="#ffb86b" />
          </linearGradient>
        </defs>
      </svg>

      <div ref={cardRef} className={styles.card}>
        <div ref={splashRef} className={styles.splash} />

        <div className={styles.cardInner}>
          <h1 ref={titleRef} className={styles.title}>
            {titleWords.map((word, i) => (
              <span key={i}>{word}</span>
            ))}
          </h1>
          <p className={styles.subtitle}>{subtitle}</p>

          <div className={styles.divider} />
          <div className={styles.dot} />

          {children}

          {footer ? <div className={styles.altLink}>{footer}</div> : null}
        </div>

        <div ref={watermarkRef} className={styles.watermark}>
          {watermark}
        </div>
      </div>
    </div>
  );
}
