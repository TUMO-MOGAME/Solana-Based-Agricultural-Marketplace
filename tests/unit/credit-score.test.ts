// Tests for core/credit-score.ts
// The credit-score function is the on-chain "social proof" for a farmer:
// every change of state must be deterministic and bounded.

import { describe, it, expect } from "vitest";
import {
  applyEvent,
  newFarmerScore,
  SCORE_INITIAL,
  SCORE_MIN,
  SCORE_MAX,
} from "@core/credit-score.js";

describe("credit-score: starting state", () => {
  it("a new farmer starts at 600", () => {
    const s = newFarmerScore();
    expect(s.score).toBe(SCORE_INITIAL);
    expect(s.score).toBe(600);
  });

  it("a new farmer has zero history", () => {
    const s = newFarmerScore();
    expect(s.totalPacks).toBe(0);
    expect(s.successfulRepayments).toBe(0);
    expect(s.defaults).toBe(0);
    expect(s.insuranceTriggers).toBe(0);
  });
});

describe("credit-score: deltas", () => {
  it("a successful repayment adds +20", () => {
    const s = applyEvent(newFarmerScore(), { kind: "successful_repayment" });
    expect(s.score).toBe(620);
    expect(s.successfulRepayments).toBe(1);
    expect(s.totalPacks).toBe(1);
  });

  it("a default subtracts 100", () => {
    const s = applyEvent(newFarmerScore(), { kind: "default" });
    expect(s.score).toBe(500);
    expect(s.defaults).toBe(1);
  });

  it("an insurance-triggered season does not change the score", () => {
    const s = applyEvent(newFarmerScore(), { kind: "insurance_triggered" });
    expect(s.score).toBe(600);
    expect(s.insuranceTriggers).toBe(1);
  });

  it("an insurance-triggered season still increments totalPacks", () => {
    const s = applyEvent(newFarmerScore(), { kind: "insurance_triggered" });
    expect(s.totalPacks).toBe(1);
  });
});

describe("credit-score: bounds", () => {
  it("clamps to floor of 300 even after multiple defaults", () => {
    let s = newFarmerScore();
    for (let i = 0; i < 10; i++) s = applyEvent(s, { kind: "default" });
    expect(s.score).toBe(SCORE_MIN);
    expect(s.score).toBe(300);
  });

  it("clamps to ceiling of 850 even after many repayments", () => {
    let s = newFarmerScore();
    for (let i = 0; i < 50; i++) s = applyEvent(s, { kind: "successful_repayment" });
    expect(s.score).toBe(SCORE_MAX);
    expect(s.score).toBe(850);
  });
});

describe("credit-score: realistic farmer journeys", () => {
  it("three successful seasons in a row gives +60", () => {
    let s = newFarmerScore();
    s = applyEvent(s, { kind: "successful_repayment" });
    s = applyEvent(s, { kind: "successful_repayment" });
    s = applyEvent(s, { kind: "successful_repayment" });
    expect(s.score).toBe(660);
    expect(s.successfulRepayments).toBe(3);
    expect(s.totalPacks).toBe(3);
  });

  it("two successful seasons then a drought trigger preserves earned score", () => {
    let s = newFarmerScore();
    s = applyEvent(s, { kind: "successful_repayment" });
    s = applyEvent(s, { kind: "successful_repayment" });
    s = applyEvent(s, { kind: "insurance_triggered" });
    expect(s.score).toBe(640);
    expect(s.insuranceTriggers).toBe(1);
  });

  it("a default after good history still hurts but is recoverable", () => {
    let s = newFarmerScore();
    for (let i = 0; i < 5; i++) s = applyEvent(s, { kind: "successful_repayment" });
    expect(s.score).toBe(700);
    s = applyEvent(s, { kind: "default" });
    expect(s.score).toBe(600);
  });
});
