"use client";

// React hook + helpers around `/api/price/sol-zar`.
//
// The hook polls every 60s. The "X seconds ago" indicator stays live
// without forcing every consumer to re-render — that's handled inside
// <RateFreshnessTag /> with its own 5s tick. Keep them separate.
//
// On a network failure, the route falls back to the most recent
// successful value with `stale: true`. The hook surfaces that as
// `stale`; UI should show a visible warning so the user knows the
// number isn't current.
//
// We never invent a value. If `rate === null` the UI must show a
// "loading" or "—" placeholder, never a hardcoded peg.

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 60_000;

export type SolZarRate = {
  /** SOL → ZAR multiplier (e.g., 1 SOL ≈ 4 200 ZAR → 4200). null while loading or on hard failure. */
  rate: number | null;
  /** Component prices, useful for debug overlays. */
  solUsd: number | null;
  usdZar: number | null;
  /** ms epoch — when we last successfully received a value. */
  fetchedAt: number | null;
  /** Pyth on-chain publish_time, sec since epoch. */
  pythPublishTime: number | null;
  /** True if the value is older than the cache TTL (i.e., upstream failed and we returned the last known value). */
  stale: boolean;
  /** Loading state — true until the first response lands. */
  loading: boolean;
  /** Last error message, if any. */
  error: string | null;
};

const INITIAL: SolZarRate = {
  rate: null,
  solUsd: null,
  usdZar: null,
  fetchedAt: null,
  pythPublishTime: null,
  stale: false,
  loading: true,
  error: null,
};

type RouteResponse = {
  sol_zar: number | null;
  sol_usd?: number;
  usd_zar?: number;
  fetched_at?: number;
  pyth_publish_time?: number;
  stale?: boolean;
  error?: string;
};

export function useSolZarRate(): SolZarRate {
  const [state, setState] = useState<SolZarRate>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch("/api/price/sol-zar", { cache: "no-store" });
        const json = (await res.json()) as RouteResponse;
        if (cancelled) return;

        if (json.sol_zar !== null && json.sol_zar !== undefined) {
          setState({
            rate: json.sol_zar,
            solUsd: json.sol_usd ?? null,
            usdZar: json.usd_zar ?? null,
            fetchedAt: json.fetched_at ?? null,
            pythPublishTime: json.pyth_publish_time ?? null,
            stale: !!json.stale,
            loading: false,
            error: json.error ?? null,
          });
        } else {
          setState((prev) => ({
            ...prev,
            loading: false,
            stale: true,
            error: json.error ?? `route returned ${res.status}`,
          }));
        }
      } catch (e) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          stale: true,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    };

    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}

/** Convert lamports → Rand (integer) using the live rate. Returns null if rate is missing. */
export function lamportsToZar(lamports: number | bigint, rate: number | null): number | null {
  if (rate === null) return null;
  const sol = Number(lamports) / 1_000_000_000;
  return Math.round(sol * rate);
}

/** Convert SOL → Rand (integer) using the live rate. Returns null if rate is missing. */
export function solToZar(sol: number, rate: number | null): number | null {
  if (rate === null) return null;
  return Math.round(sol * rate);
}

/** Human "12s ago" / "3m ago" / "2h ago". Falls back to em-dash if unknown. */
export function formatAge(fetchedAt: number | null, nowMs: number = Date.now()): string {
  if (!fetchedAt) return "—";
  const ageMs = Math.max(0, nowMs - fetchedAt);
  const sec = Math.floor(ageMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}
