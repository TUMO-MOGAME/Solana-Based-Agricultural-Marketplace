# Architecture

> Living document. Update as the build evolves. Keep aligned with `programs/` and `app/`.

## High-level data flow

```
   ┌────────────┐     ┌──────────────┐     ┌─────────────────┐
   │  Farmer    │     │   Co-op      │     │   Suppliers     │
   │  (mobile)  │     │  (web)       │     │  (off-chain)    │
   └─────┬──────┘     └──────┬───────┘     └────────┬────────┘
         │                   │                      │
         ▼                   ▼                      ▼
   ┌─────────────────────────────────────────────────────┐
   │                 Vuna API (Node.js)                  │
   │   registration · KYC · supplier inventory · reports │
   └────────────────┬────────────────────┬───────────────┘
                    │                    │
                    ▼                    ▼
   ┌──────────────────────┐    ┌────────────────────────┐
   │  Solana programs     │    │  PostgreSQL (Supabase) │
   │  (Anchor)            │    │  off-chain state       │
   │                      │    │  POPIA-sensitive PII   │
   │  · FarmerAccount     │    └────────────────────────┘
   │  · GrowPack          │
   │  · OracleCheck       │
   │  · Repayment         │
   │  · CreditScore       │
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Pyth Network        │
   │  weather feeds       │
   └──────────────────────┘
```

## On-chain programs

All programs live in `programs/`. Anchor (Rust) is the framework. We use PDAs everywhere; no client-controlled keypairs for state accounts.

### `FarmerAccount` (PDA)

- Seeds: `["farmer", co_op_pubkey, farmer_id_hash]`
- Stores: region code, current credit score, history hash (Merkle root over completed Grow Packs), active pack count.
- **No PII on-chain.** Names, phone numbers, ID numbers stay in PostgreSQL under POPIA controls. We store only a hash.

### `GrowPack` (account + instructions)

- Seeds: `["pack", farmer_pda, season_id]`
- Lifecycle: `Requested` → `Approved` → `Disbursed` → `Active` → `(InsurancePaid)` → `Repaid` / `Defaulted`
- Stores: principal, supplier addresses, insurance threshold (rainfall mm + window), maturity date.

### `OracleCheck` (off-chain crank + on-chain instruction)

- An off-chain crank reads weather data daily and calls the on-chain `check_threshold` instruction.
- If accumulated rainfall < threshold over the policy window, payout fires automatically.

**Important — the weather oracle is NOT Pyth.** A 2026-05-06 spike (`spikes/oracle-check/`) confirmed Pyth has zero weather feeds — it is purely price data. We are evaluating:

1. **Switchboard** (next spike) — flexible custom data feeds on Solana
2. **Chainlink Functions** — call any HTTP API (e.g. SAWS)
3. **Custom oracle** — ingest SAWS data, post attestations from an account we control
4. **Underwriter-signed attestation** — likely *anyway* because the Insurance Act 2017 requires a licensed underwriter; the underwriter computes the parametric trigger and signs, the contract releases on signature

Decision is pending. Most likely outcome is option 4 combined with one of 1-3 as the data source.

**Pyth IS still on the stack** for *price reference*: `FX.USD/ZAR` for stablecoin ↔ Rand display, and crop futures (`Commodities.CO*/USD`, `Commodities.WH*/USD`) for fair-value reference at harvest sale. Useful, just not for triggers.

### `Repayment`

- Called when the farmer's harvest is sold via the marketplace.
- Deducts the principal + service fee from sale proceeds.
- Updates `FarmerAccount` history hash and credit score.

### `CreditScore` (view)

- Deterministic function over the farmer's on-chain history.
- Read-only — exposed for partner lenders to evaluate cross-platform.

## Off-chain services

### `app/` — Next.js frontend

Two surfaces:

- **Farmer mobile** (PWA): onboarding, dashboard, apply-for-pack, weather/insurance status, marketplace.
- **Co-op web**: farmer roster, pack approvals, alerts, reports, supplier management.

Wallet abstraction: custodial / Magic.link in production. Farmer **never** sees a seed phrase, public key, or token symbol.

### `api/` — Node.js backend

- Auth via Supabase
- Farmer registration + KYC pipeline (handed off to co-op for in-person verification)
- Supplier inventory & marketplace listings
- Reporting bridge to SARS / FSCA (for CASP compliance)
- Reads on-chain state via Solana web3.js (or Helius RPC)

## What is on-chain vs off-chain — the rule

| On-chain | Off-chain |
|-|-|
| Money flows | Identity, PII |
| Insurance trigger logic | KYC documents |
| Credit-history hash | Marketplace listings |
| Repayment record | Co-op approval workflow |
| Loan parameters | Logistics / delivery confirmation |

If a piece of data is sensitive (POPIA) or doesn't need to be trustless, it belongs off-chain. Default off-chain unless there's a real reason otherwise.

## Critical paths to validate first

1. ~~**Pyth weather integration**~~ → **DONE.** Pyth has no weather feeds. See `spikes/oracle-check/FINDINGS.md`.
2. ~~**Switchboard probe**~~ → **DONE.** Switchboard is build-your-own-oracle infrastructure, not a source of weather feeds. Means options (a) custom oracle and (b) Switchboard collapse to the same decision.
3. **Underwriting partnership.** The Insurance Act 2017 forces us into a relationship with a licensed insurer. Identify candidates (LBIC / Santam Agriculture / Hollard / Old Mutual Insure) and confirm their willingness to underwrite a parametric product. This shapes the oracle architecture — the underwriter likely IS the oracle (signs attestations the program verifies). See `docs/outreach/`.
4. **Custodial wallet UX.** Farmer must never see a seed phrase. Pick the provider (Magic.link, Privy, custom) before committing to a farmer-facing wallet flow. *The current shipped frontend uses Phantom for hackathon-stage demo only.*
5. **Co-op approval flow.** The 48-hour human review is a feature, not a bug — it's how we keep fraud down.

## Where the architecture currently stands (2026-05-08)

The on-chain program implements the full Grow Pack lifecycle with deterministic numerics ported from `core/`. The `app/` frontend reads + writes against the deployed devnet program via hand-rolled Borsh codecs in `app/src/lib/vuna/program.ts`. Demo data is created via `app/scripts/setup-devnet-demo.mjs`.

The `trigger_insurance_payout` instruction currently accepts a rainfall percentage from the caller and computes the payout amount itself via `ParametricPolicy::evaluate_payout`. When the underwriter integration lands (per item 3 above), a sibling `attest_insurance_payout` instruction will accept a signed underwriter attestation as the source of truth, with the on-chain code merely verifying the signature.

Live: `7LUkUHVazSw732334JKFP88VAFc4iYXXJZkgFnZV9kqA` on devnet, frontend at https://solana-based-agricultural-marketpla.vercel.app/.
