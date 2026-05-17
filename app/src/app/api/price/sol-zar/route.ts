// Live SOL → ZAR rate. Replaces the old "1 SOL = R 1,000 demo peg" lie.
//
// Composition: SOL/USD × USD/ZAR.
//
//   - SOL/USD comes from Pyth Network's Hermes HTTP API. Pyth is the
//     on-chain oracle network Solana itself runs on, and Hermes is its
//     off-chain HTTP gateway. Sub-second latency, free, no key.
//
//   - USD/ZAR comes from Frankfurter (ECB rates, free, no key). Updated
//     once per business day — that's a known limitation. Intraday FX moves
//     for USD/ZAR are typically <1%, so a daily rate is materially correct
//     for a display value. The previous hardcoded peg was wrong by orders
//     of magnitude; this is a strict improvement. If we later need
//     intraday FX, swap to an intraday source (FXRatesAPI / Open Exchange
//     Rates / Pyth's USD/ZAR feed if/when listed).
//
// Server-side cache: 30s. Multiple users hitting the dashboard at the
// same time only cost one upstream fetch every 30s.
//
// On upstream failure: if we have a cached value of any age, return it
// with stale=true so the UI can warn the user. If we have nothing at
// all, return 503 — never fall back to a hardcoded peg, because lying
// to the user about money is exactly the bug this route fixes.

import { NextResponse } from "next/server";

// Pyth SOL/USD price feed ID (mainnet, stable identifier across
// upgrades). Hex string, with or without the 0x prefix — Hermes accepts
// either.
const SOL_USD_FEED_ID =
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

const PYTH_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${SOL_USD_FEED_ID}`;
// Frankfurter migrated from .app to .dev/v1/ in 2025. Hit the canonical
// URL directly to avoid the 301-redirect round-trip on every cache miss.
const FX_URL = "https://api.frankfurter.dev/v1/latest?from=USD&to=ZAR";

const CACHE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8_000;

type CacheEntry = {
  sol_zar: number;
  sol_usd: number;
  usd_zar: number;
  pyth_publish_time: number; // seconds since epoch
  fx_date: string; // ECB date, ISO YYYY-MM-DD
  fetched_at: number; // ms since epoch
};

let cache: CacheEntry | null = null;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFresh(): Promise<CacheEntry> {
  const [pythRes, fxRes] = await Promise.all([
    fetchWithTimeout(PYTH_URL),
    fetchWithTimeout(FX_URL),
  ]);

  if (!pythRes.ok) {
    throw new Error(`pyth ${pythRes.status} ${pythRes.statusText}`);
  }
  if (!fxRes.ok) {
    throw new Error(`fx ${fxRes.status} ${fxRes.statusText}`);
  }

  const pythJson = (await pythRes.json()) as {
    parsed?: Array<{
      price?: { price?: string; expo?: number; publish_time?: number };
    }>;
  };
  const fxJson = (await fxRes.json()) as {
    rates?: { ZAR?: number };
    date?: string;
  };

  const priceStr = pythJson.parsed?.[0]?.price?.price;
  const expo = pythJson.parsed?.[0]?.price?.expo;
  const publishTime = pythJson.parsed?.[0]?.price?.publish_time;
  if (priceStr === undefined || expo === undefined || publishTime === undefined) {
    throw new Error("pyth response missing sol/usd price");
  }
  // Pyth quotes price as integer × 10^expo (expo is negative)
  const sol_usd = Number(priceStr) * Math.pow(10, expo);
  if (!isFinite(sol_usd) || sol_usd <= 0) {
    throw new Error(`pyth returned non-positive sol/usd: ${sol_usd}`);
  }

  const usd_zar = fxJson.rates?.ZAR;
  const fxDate = fxJson.date;
  if (usd_zar === undefined || !fxDate) {
    throw new Error("fx response missing usd/zar");
  }
  if (!isFinite(usd_zar) || usd_zar <= 0) {
    throw new Error(`fx returned non-positive usd/zar: ${usd_zar}`);
  }

  return {
    sol_zar: sol_usd * usd_zar,
    sol_usd,
    usd_zar,
    pyth_publish_time: publishTime,
    fx_date: fxDate,
    fetched_at: Date.now(),
  };
}

export async function GET() {
  const now = Date.now();

  // Hot cache hit.
  if (cache && now - cache.fetched_at < CACHE_TTL_MS) {
    return NextResponse.json({ ...cache, cached: true, stale: false });
  }

  try {
    cache = await fetchFresh();
    return NextResponse.json({ ...cache, cached: false, stale: false });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);

    // Soft-fallback to a stale cache if we have one — but tell the UI
    // it's stale so it can warn the user.
    if (cache) {
      return NextResponse.json({
        ...cache,
        cached: true,
        stale: true,
        error: err,
      });
    }

    // No cache at all → fail loudly. Never lie with a hardcoded peg.
    return NextResponse.json(
      { error: err, stale: true, sol_zar: null },
      { status: 503 },
    );
  }
}
