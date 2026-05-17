"use client";

// Small inline tag that displays the SOL/ZAR rate's freshness:
//
//   live · 12s ago         (rate is current)
//   stale · 4m ago         (upstream failed, falling back to cached)
//   loading…               (first request hasn't landed yet)
//   unavailable            (hard failure, no cached value)
//
// Lives in its own component because it ticks every 5s to keep
// "X seconds ago" live. Putting that tick inside the parent would
// re-render unrelated UI; putting it inside `useSolZarRate` would
// re-render every consumer. Isolated tick → isolated re-render.

import { useEffect, useState } from "react";
import { formatAge, type SolZarRate } from "./use-sol-zar-rate";

const TICK_MS = 5_000;

export function RateFreshnessTag({ rate }: { rate: SolZarRate }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (rate.loading) {
    return <FreshnessShell color="rgba(255, 230, 210, 0.4)">loading…</FreshnessShell>;
  }

  if (rate.rate === null) {
    return (
      <FreshnessShell color="#ffb0a3" title={rate.error ?? "rate unavailable"}>
        rate unavailable
      </FreshnessShell>
    );
  }

  if (rate.stale) {
    return (
      <FreshnessShell color="#ffb86b" title={rate.error ?? "live feed unavailable — showing last known value"}>
        stale · {formatAge(rate.fetchedAt, now)}
      </FreshnessShell>
    );
  }

  return (
    <FreshnessShell color="#7adf7d">
      live · {formatAge(rate.fetchedAt, now)}
    </FreshnessShell>
  );
}

function FreshnessShell({
  color,
  title,
  children,
}: {
  color: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color,
        opacity: 0.85,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          background: color,
          opacity: 0.8,
        }}
      />
      {children}
    </span>
  );
}
