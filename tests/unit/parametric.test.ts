// Tests for core/parametric.ts
// This is the function that decides whether a farmer gets paid out.
// Every threshold must be tested at the boundary AND just inside / outside.
// Bugs here cost real money to real farmers.

import { describe, it, expect } from "vitest";
import { evaluatePayout } from "@core/parametric.js";
import { DEFAULT_POLICY } from "../helpers/fixtures.js";

describe("parametric: no-payout cases", () => {
  it("rainfall above threshold → no payout", () => {
    const r = evaluatePayout(95, DEFAULT_POLICY);
    expect(r.tier).toBe("none");
    expect(r.amount).toBe(0);
  });

  it("rainfall exactly at threshold → no payout (boundary inclusive)", () => {
    const r = evaluatePayout(80, DEFAULT_POLICY);
    expect(r.tier).toBe("none");
    expect(r.amount).toBe(0);
  });

  it("rainfall at 100% of normal → no payout", () => {
    const r = evaluatePayout(100, DEFAULT_POLICY);
    expect(r.tier).toBe("none");
  });
});

describe("parametric: tier 1 (mild drought, 30% payout)", () => {
  it("rainfall 79% → tier1", () => {
    const r = evaluatePayout(79, DEFAULT_POLICY);
    expect(r.tier).toBe("tier1");
    expect(r.amount).toBe(525); // 30% of 1750
  });

  it("rainfall 70% → tier1 (just above tier2 boundary)", () => {
    const r = evaluatePayout(70, DEFAULT_POLICY);
    expect(r.tier).toBe("tier1");
  });
});

describe("parametric: tier 2 (moderate drought, 60% payout)", () => {
  it("rainfall 69% → tier2", () => {
    const r = evaluatePayout(69, DEFAULT_POLICY);
    expect(r.tier).toBe("tier2");
    expect(r.amount).toBe(1050); // 60% of 1750
  });

  it("rainfall 50% → tier2 (just above tier3 boundary)", () => {
    const r = evaluatePayout(50, DEFAULT_POLICY);
    expect(r.tier).toBe("tier2");
  });
});

describe("parametric: tier 3 (severe drought, 80% payout)", () => {
  it("rainfall 49% → tier3", () => {
    const r = evaluatePayout(49, DEFAULT_POLICY);
    expect(r.tier).toBe("tier3");
    expect(r.amount).toBe(1400); // 80% of 1750
  });

  it("rainfall 0% → tier3 (worst case)", () => {
    const r = evaluatePayout(0, DEFAULT_POLICY);
    expect(r.tier).toBe("tier3");
    expect(r.amount).toBe(1400);
  });

  it("the proposal-quoted scenario (32mm of 80mm = 40%) pays R 1 400", () => {
    const r = evaluatePayout(40, DEFAULT_POLICY);
    expect(r.tier).toBe("tier3");
    expect(r.amount).toBe(1400);
  });
});

describe("parametric: validation", () => {
  it("rejects negative rainfall", () => {
    expect(() => evaluatePayout(-5, DEFAULT_POLICY)).toThrow(/non-negative/);
  });

  it("rejects NaN rainfall", () => {
    expect(() => evaluatePayout(Number.NaN, DEFAULT_POLICY)).toThrow();
  });

  it("rejects infinite rainfall", () => {
    expect(() => evaluatePayout(Number.POSITIVE_INFINITY, DEFAULT_POLICY)).toThrow();
  });

  it("rejects threshold ≤ 0", () => {
    expect(() =>
      evaluatePayout(50, { thresholdPercent: 0, maxPayout: 1000 }),
    ).toThrow(/thresholdPercent/);
  });

  it("rejects threshold > 100", () => {
    expect(() =>
      evaluatePayout(50, { thresholdPercent: 101, maxPayout: 1000 }),
    ).toThrow(/thresholdPercent/);
  });

  it("rejects negative maxPayout", () => {
    expect(() =>
      evaluatePayout(50, { thresholdPercent: 80, maxPayout: -1 }),
    ).toThrow(/maxPayout/);
  });
});

describe("parametric: result includes a human-readable reason", () => {
  it("explains why no payout fired", () => {
    const r = evaluatePayout(95, DEFAULT_POLICY);
    expect(r.reason).toMatch(/exceeded/);
  });

  it("explains which tier fired", () => {
    const r = evaluatePayout(40, DEFAULT_POLICY);
    expect(r.reason).toMatch(/80%/);
  });
});
