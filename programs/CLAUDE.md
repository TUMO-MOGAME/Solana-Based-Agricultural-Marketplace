# programs/ — CLAUDE context

Solana / Anchor on-chain code lives here. **Deployed to devnet at `7LUkUHVazSw732334JKFP88VAFc4iYXXJZkgFnZV9kqA`.**

## Status

✅ Live — `programs/vuna/` is a full Anchor 1.0.2 project, builds clean, deployed, and integration-tested via litesvm.

## What we built

| Account / instruction | Purpose |
|-|-|
| `FarmerAccount` (PDA) | Farmer identity hash, region, credit-history root, score, lifetime counters |
| `GrowPack` (PDA) | Pricing fields, insurance policy params, oracle observation, settlement amounts, lifecycle status |
| `GrowPackStatus` enum | Requested → Approved → Active → (InsurancePaid \| Repaid \| Defaulted) |
| `register_farmer` | Cooperative onboards a farmer; creates the FarmerAccount PDA |
| `request_grow_pack` | Cooperative submits an application; computes bundle/fee/repayment math on-chain via `GrowPack::quote` |
| `approve_grow_pack` | Cooperative approves; status Requested → Approved |
| `disburse_grow_pack` | Inputs delivered; status Approved → Active (insurance becomes live) |
| `trigger_insurance_payout` | Oracle/cooperative attests rainfall %; program computes payout amount itself via `ParametricPolicy::evaluate_payout` (caller can't inflate). Status Active → InsurancePaid |
| `settle_repayment` | Harvest sale closes the pack; splits available funds via `GrowPack::settle_at_harvest`; updates farmer credit score via `FarmerAccount::apply_event` |

The numerical rules (credit score deltas, parametric tiers, repayment split) are ports of `core/*.ts` — same test cases verified in both languages.

## Tests

| Layer | Where | Count |
|-|-|-|
| Cargo unit tests (host-side, pure logic) | `programs/vuna/programs/vuna/src/state.rs::tests` | 41 |
| Litesvm integration tests (loads `vuna.so`, full lifecycle) | `programs/vuna/programs/vuna/tests/lifecycle.rs` | 3 |

```bash
cd programs/vuna/programs/vuna
cargo test --lib              # 41 unit tests
cargo test --test lifecycle   # 3 integration tests
```

## Rules

- **No PII on-chain.** Hashes only. PII stays in PostgreSQL under POPIA controls.
- **PDAs everywhere.** No client-controlled keypairs for state accounts.
- **Pyth is NOT the weather oracle.** Confirmed empirically — Pyth has no rainfall feeds. The `trigger_insurance_payout` instruction currently accepts a rainfall percentage from the caller and computes the payout on-chain. In production this becomes either an underwriter-attestation (Insurance Act 2017 forces a licensed underwriter into the loop) or a Switchboard-relayed SAWS feed. See `spikes/oracle-check/FINDINGS.md`.
- **Pyth IS still on the stack** for *price reference* (FX.USD/ZAR, crop futures) — useful for the frontend, not for triggers.
- **Test on devnet.** Real-money mainnet deploy requires audit + bounty.
- **Pause authority on critical paths.** Smart contracts must be pause-able by an admin in case of exploit. Document the pause key custody plan before mainnet.
- **The program is upgradeable** — authority is the deploying wallet (`9ndRtL...veYeKyQ`). Plan to renounce upgrade authority after audit + first mainnet quarter.

## How to upgrade the on-chain program

```bash
cd programs/vuna/programs/vuna
cargo build-sbf
cd ../..
solana program deploy target/deploy/vuna.so --url devnet
```

## Frontend integration

The Next.js app under `app/src/lib/vuna/program.ts` has hand-rolled Borsh decoders + instruction encoders for this program. The Anchor IDL builder is currently broken on Windows, so the encoders use hardcoded discriminators (computed offline from `sha256("global:<ix-name>")[0..8]`).

When you change the Rust struct layout in `state.rs` or change instruction signatures in `instructions/`, **update the matching encoder/decoder in `app/src/lib/vuna/program.ts` in the same commit** — the test suite won't catch a layout drift between Rust and TS automatically (the byte-layout tests in `program.test.ts` will, but only if you remember to update them).

## Where things plug in

```
core/*.ts              ──port──>  programs/vuna/programs/vuna/src/state.rs
                                     │
                                     ▼
                                  vuna.so
                                     │
                                     ▼
app/src/lib/vuna/program.ts (Borsh codecs + ix encoders)
                                     │
                                     ▼
app/src/app/dashboard/page.tsx (read path: fetchGrowPack)
app/src/app/dashboard/apply-tab.tsx (write path: register_farmer + request_grow_pack)
```
