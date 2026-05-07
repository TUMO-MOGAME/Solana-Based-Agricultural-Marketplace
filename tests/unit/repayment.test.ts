// Tests for core/repayment.ts
// At harvest, the farmer's sale proceeds split into (repaid, surplus, defaulted).
// Every farmer-affecting Rand must be accounted for: repaid + surplus + defaulted
// must always equal the larger of saleProceeds, totalRepaymentDue.

import { describe, it, expect } from "vitest";
import { settleAtHarvest } from "@core/repayment.js";

describe("repayment: full repayment + surplus", () => {
  it("sale exceeds due → full repayment, surplus to farmer", () => {
    const r = settleAtHarvest(2500, 1820);
    expect(r.repaid).toBe(1820);
    expect(r.surplus).toBe(680);
    expect(r.defaulted).toBe(0);
  });

  it("sale equal to due → exact repayment, zero surplus, zero default", () => {
    const r = settleAtHarvest(1820, 1820);
    expect(r.repaid).toBe(1820);
    expect(r.surplus).toBe(0);
    expect(r.defaulted).toBe(0);
  });
});

describe("repayment: partial repayment", () => {
  it("sale < due → partial repayment, remainder defaults", () => {
    const r = settleAtHarvest(1200, 1820);
    expect(r.repaid).toBe(1200);
    expect(r.surplus).toBe(0);
    expect(r.defaulted).toBe(620);
  });

  it("zero sale → total default", () => {
    const r = settleAtHarvest(0, 1820);
    expect(r.repaid).toBe(0);
    expect(r.surplus).toBe(0);
    expect(r.defaulted).toBe(1820);
  });

  it("sale of 1 Rand → 1 Rand repaid, rest defaults", () => {
    const r = settleAtHarvest(1, 1820);
    expect(r.repaid).toBe(1);
    expect(r.defaulted).toBe(1819);
  });
});

describe("repayment: edge cases", () => {
  it("zero loan + zero sale → all zeros", () => {
    const r = settleAtHarvest(0, 0);
    expect(r.repaid).toBe(0);
    expect(r.surplus).toBe(0);
    expect(r.defaulted).toBe(0);
  });

  it("zero loan + positive sale → all surplus", () => {
    const r = settleAtHarvest(500, 0);
    expect(r.repaid).toBe(0);
    expect(r.surplus).toBe(500);
    expect(r.defaulted).toBe(0);
  });
});

describe("repayment: validation", () => {
  it("rejects negative sale proceeds", () => {
    expect(() => settleAtHarvest(-1, 1000)).toThrow(/non-negative/);
  });

  it("rejects negative repayment due", () => {
    expect(() => settleAtHarvest(1000, -1)).toThrow(/non-negative/);
  });
});

describe("repayment: invariant — every Rand is accounted for", () => {
  // (repaid + surplus) accounts for every Rand the farmer brought in.
  // (repaid + defaulted) accounts for every Rand the platform was owed.
  it.each([
    [2500, 1820],
    [1820, 1820],
    [1200, 1820],
    [0, 1820],
    [500, 0],
    [99999, 1],
  ])("invariant for sale=%i due=%i", (sale, due) => {
    const r = settleAtHarvest(sale, due);
    expect(r.repaid + r.surplus).toBe(sale);
    expect(r.repaid + r.defaulted).toBe(due);
  });
});
