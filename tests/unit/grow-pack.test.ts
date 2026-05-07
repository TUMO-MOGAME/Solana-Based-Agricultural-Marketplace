// Tests for core/grow-pack.ts
// Pricing math must match the numbers in the proposal exactly —
// the proposal is what underwriters will reference.

import { describe, it, expect } from "vitest";
import { quoteGrowPack, SERVICE_FEE_BPS_DEFAULT } from "@core/grow-pack.js";
import { PROPOSAL_PRICING } from "../helpers/fixtures.js";

describe("grow-pack: canonical proposal numbers", () => {
  it("the 2 ha maize Grow Pack from the proposal totals R 1 655", () => {
    const q = quoteGrowPack(PROPOSAL_PRICING);
    expect(q.bundleCost).toBe(1655);
  });

  it("service fee at 10% of R 1 655 is R 165", () => {
    const q = quoteGrowPack(PROPOSAL_PRICING);
    expect(q.serviceFee).toBe(165);
  });

  it("total repayment is R 1 820", () => {
    const q = quoteGrowPack(PROPOSAL_PRICING);
    expect(q.totalRepayment).toBe(1820);
  });
});

describe("grow-pack: arithmetic", () => {
  it("bundleCost = seeds + fertilizer + insurance", () => {
    const q = quoteGrowPack({
      seedCost: 100, fertilizerCost: 200, insuranceCost: 50,
      serviceFeeBps: 1000,
    });
    expect(q.bundleCost).toBe(350);
  });

  it("totalRepayment = bundleCost + serviceFee", () => {
    const q = quoteGrowPack({
      seedCost: 100, fertilizerCost: 200, insuranceCost: 50,
      serviceFeeBps: 2000, // 20%
    });
    expect(q.totalRepayment).toBe(q.bundleCost + q.serviceFee);
    expect(q.serviceFee).toBe(70); // 20% of 350
    expect(q.totalRepayment).toBe(420);
  });

  it("zero service fee leaves bundleCost == totalRepayment", () => {
    const q = quoteGrowPack({
      seedCost: 500, fertilizerCost: 500, insuranceCost: 100,
      serviceFeeBps: 0,
    });
    expect(q.serviceFee).toBe(0);
    expect(q.totalRepayment).toBe(q.bundleCost);
  });

  it("default service fee bps is 1000 (10%)", () => {
    expect(SERVICE_FEE_BPS_DEFAULT).toBe(1000);
  });
});

describe("grow-pack: validation", () => {
  it("rejects negative seed cost", () => {
    expect(() =>
      quoteGrowPack({
        seedCost: -1, fertilizerCost: 0, insuranceCost: 0, serviceFeeBps: 1000,
      }),
    ).toThrow(/non-negative/);
  });

  it("rejects service fee > 100%", () => {
    expect(() =>
      quoteGrowPack({
        seedCost: 100, fertilizerCost: 100, insuranceCost: 100, serviceFeeBps: 10_001,
      }),
    ).toThrow(/serviceFeeBps/);
  });

  it("rejects negative service fee bps", () => {
    expect(() =>
      quoteGrowPack({
        seedCost: 100, fertilizerCost: 100, insuranceCost: 100, serviceFeeBps: -1,
      }),
    ).toThrow(/serviceFeeBps/);
  });
});

describe("grow-pack: rounding", () => {
  it("service fee floors fractional cents", () => {
    // 333 * 1000 / 10000 = 33.3 → 33
    const q = quoteGrowPack({
      seedCost: 333, fertilizerCost: 0, insuranceCost: 0, serviceFeeBps: 1000,
    });
    expect(q.serviceFee).toBe(33);
    expect(q.totalRepayment).toBe(366);
  });
});
