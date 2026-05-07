# tests/ — CLAUDE context

Vitest test suite for the `core/` business-logic library.

## Rules for adding tests

1. **One test file per `core/` module.** If a new module appears in `core/`, add `tests/unit/<module>.test.ts` in the same commit.
2. **Match describe/it style.** Read `tests/unit/parametric.test.ts` as the template — `describe` for behaviour groups, `it` for single asserted truths.
3. **Test the boundary AND just inside / outside.** Drought tier boundaries are at 80%, 70%, 50%; the test file asserts each.
4. **Use the canonical fixtures.** `tests/helpers/fixtures.ts` mirrors the numbers in `docs/proposal.pdf`. If the proposal changes, the fixtures change, every test catches the drift.
5. **Keep tests deterministic.** No clocks, no randomness.

## Where the on-chain tests will go later

When we scaffold `programs/`, the Anchor program reimplements `core/` in Rust. Anchor's own tests live in `programs/tests/` (Rust + mocha). The same numeric test cases from `tests/unit/` should be ported there to keep the two implementations honest. Don't merge the two test suites — they cover different layers.
