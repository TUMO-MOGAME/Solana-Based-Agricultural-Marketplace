# core/ — CLAUDE context

Pure TypeScript business logic for Project Vuna. **Zero dependencies on React, Solana, Express, or any framework.** Every function in here is deterministic and testable in isolation.

## Why this exists

The same rules live in three places:
1. The Solana program (Rust/Anchor) — binding source of truth on-chain
2. `app/` — needs to preview computations to the farmer before submission
3. `api/` — needs to reconcile off-chain reports

If they disagree, we ship bugs. So `core/` is the **canonical spec** in TypeScript. It's used directly by `app/` and `api/`, and the Rust on-chain code reimplements it with parallel tests. Test cases in `tests/unit/` apply to both.

## Modules

| File | Purpose |
|-|-|
| `types.ts` | Shared types: `GrowPack`, `Farmer`, `Region`, `Crop`, etc. |
| `credit-score.ts` | Credit score arithmetic — start, repayment, default, insurance bumps. |
| `grow-pack.ts` | Pricing math — bundle total, service fee, total repayment. |
| `parametric.ts` | Insurance trigger and payout-tier logic from rainfall-vs-norm percentage. |
| `repayment.ts` | Harvest-sale split: full repayment, partial, default. |
| `currency.ts` | Rand formatting. Single source for `R 1,655` etc. |
| `validation.ts` | Input validation — hectares, region, crop. |
| `index.ts` | Barrel re-export. |

## Rules

- **Pure functions only.** No I/O, no fetch, no DB calls. If a function needs external data, it takes it as an argument.
- **No `any`.** TypeScript strict mode is on. No bypasses.
- **Integer cents (or whole Rand) for money.** No floats. Float arithmetic on currency is a bug waiting to happen.
- **Tests in `tests/unit/` track this folder one-to-one.** Every function exported from `core/` has at least one test in the matching `*.test.ts`.
- **Don't add framework code here.** If something needs React, Express, or `@solana/web3.js`, it belongs in `app/`, `api/`, or `programs/` — not here.
