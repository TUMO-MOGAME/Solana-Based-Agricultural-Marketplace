# Oracle spike — findings

**Date:** 2026-05-06
**Question:** Does Pyth have rainfall data we can use for parametric drought insurance?

---

## Headline

**Pyth has zero weather data. Confirmed.** All 3,027 Pyth feeds are price feeds (Equity / Crypto / FX / Commodities / Rates). The drought-insurance trigger cannot use Pyth.

The proposal and architecture docs assumed otherwise. They are now wrong and must be corrected.

## Method

Hit `https://hermes.pyth.network/v2/price_feeds`, dumped the full feed catalog, categorized by asset type, and grep'd for weather and SA-relevant terms. Probe lives at `spikes/oracle-check/probe_pyth.py`.

## What Pyth actually offers (3,027 feeds)

| Asset type | Count |
|-|-:|
| Equity | 1,748 |
| Crypto | 584 |
| FX | 290 |
| Crypto Redemption Rate | 161 |
| Commodities | 126 |
| ECO | 44 |
| Rates | 26 |
| Kalshi | 19 |
| Metal | 11 |
| Crypto NAV | 10 |
| Crypto Index | 8 |

The "weather" matches the probe surfaced were all substring noise — `rain` matching **UK·RAIN·ian Hryvnia**, `soil` matching **Ga·SOIL** futures, etc. No real weather feeds exist.

## What Pyth IS still useful for (silver lining)

The probe did find feeds that matter to Vuna for *other* features:

| Feed | Vuna use case |
|-|-|
| `FX.USD/ZAR`, `FX.EUR/ZAR`, `FX.GBP/ZAR`, `FX.ZAR/JPY` | Stablecoin ↔ Rand conversion display in the app. |
| `Commodities.COZ6/USD`, `Commodities.COH6/USD` … (corn / maize futures) | Reference price at harvest sale — confirm farmer is getting fair value. |
| `Commodities.WHN6/USD` … (wheat futures) | Same, for wheat farmers. |
| `Commodities.SON6/USD` … (soybean futures) | Same, for soya. |

So Pyth is still on the stack — just for **price reference**, not for **insurance triggers**.

## The actual problem this opens

We need a different source for rainfall data. The realistic options are:

### Option A — Switchboard (preferred next probe)

Switchboard supports custom data feeds on Solana — they're more flexible than Pyth's price-only model. Some weather/agriculture feeds exist in their broader ecosystem. **Verifying this is the next spike.**

### Option B — Chainlink Functions on Solana

Lets a smart contract call any HTTP API (e.g. SAWS, OpenWeatherMap, NASA POWER). Robust but introduces Chainlink as a third-party dependency and adds cost per call.

### Option C — Build our own oracle

Run a simple off-chain crank that ingests **SAWS** (South African Weather Service) data and posts it to a Solana program we control. Cheapest and most accurate for SA. Trust assumption shifts to us — we are the oracle.

### Option D — Partner with an insurance underwriter who handles the trigger

Move the parametric trigger off-chain entirely. Underwriter computes payout, signs an attestation, smart contract releases funds on attestation. **This is also how we comply with the Insurance Act 2017** (insurance must be underwritten by a licensed insurer). So this is probably going to happen *anyway*, regardless of which oracle we pick.

## Switchboard probe (2026-05-07)

`spikes/oracle-check/probe_switchboard.py` confirmed Crossbar (Switchboard's relay layer) is healthy and reachable. But the architectural picture is:

- **Switchboard is a build-your-own-oracle platform.** Anyone can write a feed.
- There is no central catalog of pre-built weather feeds equivalent to Pyth's price catalog.
- "Use Switchboard for weather" = we still write the data ingestion ourselves; we just publish through Switchboard's queues/oracles instead of running our own crank.

**This means Options A (Switchboard) and B (custom oracle) are essentially the same decision** — *we are the oracle either way.* The only real choice is whether to operate the relay infrastructure ourselves or rent Switchboard's.

## Recommendation

1. **Stop assuming Pyth = weather.** Done. `docs/architecture.md` updated 2026-05-06.
2. **Switchboard probed.** It is build-your-own-oracle infrastructure, not a source of weather feeds.
3. **Commit to the underwriter-attestation model.** The Insurance Act 2017 forces us to partner with a licensed underwriter anyway. The underwriter computes the parametric trigger and signs an attestation; the contract releases on signature. The blockchain piece becomes simpler, not more complex.
4. **Outreach to licensed agri-insurers begins now.** See `docs/outreach/`.
5. **Keep Pyth on the stack** for price reference (ZAR FX, crop futures). It is still earning its place, just not for triggers.

## What this means for the proposal

`docs/proposal.pdf` mentions Pyth as the weather oracle in §4 and §5. That claim is now wrong. When we regenerate the PDF (next iteration), update those sections to say "weather oracle" generically and footnote that the source is a Switchboard / underwriter-attestation hybrid TBD.

Don't regenerate yet — wait until after the Switchboard spike, then update once with correct information.
