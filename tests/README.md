# tests/

Test suite for Project Vuna's core business logic.

## What's tested here

Pure-function business rules from `core/` — credit scoring, Grow Pack pricing, parametric trigger and payout, harvest-sale repayment, currency formatting, input validation. These rules are the canonical spec; the Solana program (Rust/Anchor) reimplements them with parallel tests once the toolchain is installed.

These are NOT tested here (they get their own test trees once their components are scaffolded):

- Solana program execution (lives in `programs/tests/` with Anchor)
- React component rendering (lives in `app/` with Vitest + Testing Library)
- HTTP route handlers (lives in `api/` with Vitest + supertest)
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
