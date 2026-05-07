// Harvest-sale repayment math.
// Given sale proceeds and the amount due, split into repayment / surplus / default.

import type { RepaymentResult } from "./types.js";

export function settleAtHarvest(
  saleProceeds: number,
  totalRepaymentDue: number,
): RepaymentResult {
  if (saleProceeds < 0) throw new Error("saleProceeds must be non-negative");
  if (totalRepaymentDue < 0) throw new Error("totalRepaymentDue must be non-negative");

  if (saleProceeds >= totalRepaymentDue) {
    return {
      repaid: totalRepaymentDue,
      surplus: saleProceeds - totalRepaymentDue,
      defaulted: 0,
    };
  }

  return {
    repaid: saleProceeds,
    surplus: 0,
    defaulted: totalRepaymentDue - saleProceeds,
  };
}
