// Integration: the full Grow Pack happy + drought paths, end to end,
// composing the core modules. This is what the demo will walk through.
//
// Real Solana / API integration goes in additional integration tests
// once those layers exist. For now we test that the *rules* compose correctly.

import { describe, it, expect } from "vitest";
import { quoteGrowPack } from "@core/grow-pack.js";
import { evaluatePayout } from "@core/parametric.js";
import { settleAtHarvest } from "@core/repayment.js";
import { applyEvent, newFarmerScore } from "@core/credit-score.js";
import { formatRand } from "@core/currency.js";
import { validateHectares, validateCrop, validateRegion } from "@core/validation.js";
import { DEFAULT_POLICY, PROPOSAL_PRICING } from "../helpers/fixtures.js";

describe("integration: happy-path Grow Pack lifecycle", () => {
  it("Nomsa applies, plants, harvests well, repays, score goes up", () => {
    // 1. Validate her application
    expect(validateCrop("maize")).toEqual({ ok: true });
    expect(validateRegion("eastern_cape")).toEqual({ ok: true });
    expect(validateHectares(2)).toEqual({ ok: true });

    // 2. Quote the Grow Pack
    const quote = quoteGrowPack(PROPOSAL_PRICING);
    expect(formatRand(quote.bundleCost)).toBe("R 1 655");
    expect(formatRand(quote.totalRepayment)).toBe("R 1 820");

    // 3. Season finishes well — rainfall is normal, no payout fires
    const payout = evaluatePayout(95, DEFAULT_POLICY);
    expect(payout.tier).toBe("none");

    // 4. Harvest sells well — surplus to her
    const settlement = settleAtHarvest(2500, quote.totalRepayment);
    expect(settlement.repaid).toBe(1820);
    expect(settlement.surplus).toBe(680);
    expect(settlement.defaulted).toBe(0);

    // 5. Score updates
    const after = applyEvent(newFarmerScore(), { kind: "successful_repayment" });
    expect(after.score).toBe(620);
  });
});

describe("integration: drought-payout path", () => {
  it("Sipho's rainfall hits 40% — payout fires, score is preserved", () => {
    // 1. Validate
    expect(validateCrop("beans").ok).toBe(true);

    // 2. Quote
    const quote = quoteGrowPack(PROPOSAL_PRICING);
    expect(quote.totalRepayment).toBe(1820);

    // 3. Drought hits
    const payout = evaluatePayout(40, DEFAULT_POLICY);
    expect(payout.tier).toBe("tier3");
    expect(payout.amount).toBe(1400);
    expect(formatRand(payout.amount)).toBe("R 1 400");

    // 4. The insurance payout cushions the farmer.
    //    The harvest is poor — say only R 600 in sale proceeds.
    //    Insurance covers most of the loan; the harvest covers a little more.
    //    For this test we treat the payout as repayment-side coverage.
    const totalRecovered = payout.amount + 600;
    const settlement = settleAtHarvest(totalRecovered, quote.totalRepayment);
    expect(settlement.repaid).toBe(1820);
    expect(settlement.defaulted).toBe(0);

    // 5. Insurance-triggered season — score is unchanged
    const after = applyEvent(newFarmerScore(), { kind: "insurance_triggered" });
    expect(after.score).toBe(600);
    expect(after.insuranceTriggers).toBe(1);
  });
});

describe("integration: total-loss / default path", () => {
  it("Lebo's harvest fails AND no payout fires — partial default, score drops", () => {
    const quote = quoteGrowPack(PROPOSAL_PRICING);

    // No payout — rainfall was within tolerance, but the harvest still failed
    const payout = evaluatePayout(85, DEFAULT_POLICY);
    expect(payout.tier).toBe("none");

    // Sale only R 200 (failed crop, low yield)
    const settlement = settleAtHarvest(200, quote.totalRepayment);
    expect(settlement.repaid).toBe(200);
    expect(settlement.defaulted).toBe(1620);

    // Score takes the hit
    const after = applyEvent(newFarmerScore(), { kind: "default" });
    expect(after.score).toBe(500);
  });
});
