# tests/

Test suite for Project Vuna's core business logic. **99 Vitest tests, all passing.**

## What's tested here

Pure-function business rules from `core/` — credit scoring, Grow Pack pricing, parametric trigger and payout, harvest-sale repayment, currency formatting, input validation. These rules are the canonical spec; the Solana program (Rust/Anchor) reimplements them with parallel tests in `programs/vuna/programs/vuna/src/state.rs::tests` (41 cargo unit tests + 3 litesvm integration tests).

The `app/` frontend has its own separate Vitest suite at `app/src/lib/vuna/program.test.ts` — **40 tests** covering PDA derivation, on-chain pricing math, and instruction-encoder byte layouts for 5 instructions (register_farmer, request_grow_pack, approve_grow_pack, disburse_grow_pack, trigger_insurance_payout). That's a different concern (chain-client integration, not pure business rules) so it lives next to the code it tests rather than here.

**Test totals across the project: 183.** 99 (this dir) + 40 (app) + 41 cargo + 3 litesvm.

These are NOT tested here:

- Solana program execution (lives in `programs/vuna/programs/vuna/tests/lifecycle.rs`)
- Frontend Solana client (lives in `app/src/lib/vuna/program.test.ts`)
- React component rendering (not started — would live alongside its component once needed)
- HTTP route handlers in `api/` (`api/` is still an empty scaffold)
- End-to-end browser flows (Playwright, in a future `e2e/` folder)

## Layout

```
tests/
├── unit/                       one suite per core module
│   ├── credit-score.test.ts
│   ├── grow-pack.test.ts
│   ├── parametric.test.ts
│   ├── repayment.test.ts
│   ├── currency.test.ts
│   └── validation.test.ts
├── integration/                cross-module composition tests
│   └── grow-pack-flow.test.ts
└── helpers/
    └── fixtures.ts             shared test data (proposal numbers)
```

## How to run

From the project root:

```bash
npm install              # first time only
npm test                 # run everything once
npm run test:watch       # re-run on file change
npm run test:unit        # just unit suites
npm run test:integration # just integration suites
npm run test:coverage    # with coverage report
npm run typecheck        # tsc --noEmit, no tests
```

## Naming convention

- `*.test.ts` — picked up by Vitest automatically.
- One test file per source module: `tests/unit/<module>.test.ts` ↔ `core/<module>.ts`.
- `describe` blocks describe a *behaviour group* ("parametric: tier 3 (severe drought, 80% payout)").
- `it` blocks describe a *single asserted truth* ("rainfall 49% → tier3").

## Rules

- **No mocks of `core/` itself** — these are pure functions, mocking them defeats the purpose.
- **Tests use the same fixtures as the proposal** (`helpers/fixtures.ts`). If proposal numbers change, fixtures change, every dependent test catches the drift.
- **Boundary cases are non-optional.** Every threshold gets tested at the boundary AND just inside / outside.
- **Don't test private/unexported behaviour.** If a function isn't exported from `core/`, it isn't tested directly.
- **Keep tests deterministic.** No `Date.now()`, `Math.random()`, or network calls without a stable seed / mock.
