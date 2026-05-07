"""
Pyth Network feed probe.

Question: Does Pyth have rainfall / weather data we can use for
parametric crop insurance in South Africa?

Hits the public Hermes API, lists all available feeds, categorizes them,
and searches for anything weather- or SA-relevant.

Run: python spikes/oracle-check/probe_pyth.py
"""

import json
import sys
import urllib.error
import urllib.request
from collections import Counter

HERMES_URL = "https://hermes.pyth.network/v2/price_feeds"

WEATHER_TERMS = [
    "rain", "rainfall", "precipitation", "weather", "temperature",
    "humidity", "drought", "wind", "climate", "soil", "moisture",
]
SA_TERMS = [
    "south africa", "zar", "africa", "agri", "agriculture",
    "maize", "corn", "wheat", "soybean", "fertili",
]


def fetch_feeds():
    print(f"Fetching {HERMES_URL} ...")
    try:
        req = urllib.request.Request(
            HERMES_URL,
            headers={"User-Agent": "vuna-oracle-spike/0.1"},
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        print(f"  NETWORK ERROR: {e}")
        return None
    except Exception as e:
        print(f"  ERROR: {e}")
        return None


def get_attr(feed, *keys):
    a = feed.get("attributes", {}) or {}
    for k in keys:
        v = a.get(k)
        if v:
            return str(v)
    return ""


def haystack(feed):
    a = feed.get("attributes", {}) or {}
    parts = [str(v) for v in a.values() if v is not None]
    return " ".join(parts).lower()


def main():
    feeds = fetch_feeds()
    if feeds is None:
        print("\nCould not reach Pyth.")
        sys.exit(2)

    n = len(feeds)
    print(f"\nFeeds returned: {n}")

    # ---- breakdown by asset_type ----
    types = Counter()
    for f in feeds:
        types[get_attr(f, "asset_type") or "unknown"] += 1
    print("\nAsset-type breakdown:")
    for t, c in types.most_common():
        print(f"  {t:20s} {c}")

    # ---- sample of feeds (sanity check we got real data) ----
    print("\nSample of 8 feeds (any category):")
    for f in feeds[:8]:
        sym = get_attr(f, "symbol")
        desc = get_attr(f, "description", "generic_symbol")
        print(f"  {sym:30s}  {desc[:60]}")

    # ---- weather search ----
    print("\n--- Searching for WEATHER terms ---")
    weather_hits = []
    for f in feeds:
        h = haystack(f)
        for t in WEATHER_TERMS:
            if t in h:
                weather_hits.append((t, get_attr(f, "symbol"),
                                     get_attr(f, "description")))
                break
    if weather_hits:
        for t, sym, desc in weather_hits[:25]:
            print(f"  [{t}]  {sym:30s}  {desc[:60]}")
        print(f"  ... {len(weather_hits)} total")
    else:
        print("  no weather-related feeds found.")

    # ---- SA / agri search ----
    print("\n--- Searching for SA / AGRI terms ---")
    sa_hits = []
    for f in feeds:
        h = haystack(f)
        for t in SA_TERMS:
            if t in h:
                sa_hits.append((t, get_attr(f, "symbol"),
                                get_attr(f, "description")))
                break
    if sa_hits:
        for t, sym, desc in sa_hits[:25]:
            print(f"  [{t}]  {sym:30s}  {desc[:60]}")
        print(f"  ... {len(sa_hits)} total")
    else:
        print("  no SA / agri feeds found.")

    # ---- verdict ----
    print("\n" + "=" * 60)
    if not weather_hits:
        print("VERDICT: Pyth has no weather feeds.")
        print("         The drought-trigger product CANNOT rely on Pyth.")
        print()
        print("Next options:")
        print("  1. Switchboard — flexible custom data feeds on Solana")
        print("  2. Chainlink Functions — call any HTTP API (e.g. SAWS)")
        print("  3. Custom oracle — ingest SAWS, post attestations")
    else:
        print(f"VERDICT: Found {len(weather_hits)} weather candidates.")
        print("         Investigate latency, regional resolution, cost.")
    print("=" * 60)


if __name__ == "__main__":
    main()
