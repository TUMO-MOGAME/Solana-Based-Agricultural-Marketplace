// Grow Pack pricing math.
// All inputs and outputs are whole Rand (integer).

import type { GrowPackPricing, GrowPackQuote } from "./types.js";

export const SERVICE_FEE_BPS_DEFAULT = 1000; // 10%

export function quoteGrowPack(pricing: GrowPackPricing): GrowPackQuote {
  if (pricing.seedCost < 0 || pricing.fertilizerCost < 0 || pricing.insuranceCost < 0) {
    throw new Error("Grow Pack costs must be non-negative");
  }
  if (pricing.serviceFeeBps < 0 || pricing.serviceFeeBps > 10_000) {
    throw new Error("serviceFeeBps must be in [0, 10000]");
  }

  const bundleCost = pricing.seedCost + pricing.fertilizerCost + pricing.insuranceCost;
  const serviceFee = Math.floor((bundleCost * pricing.serviceFeeBps) / 10_000);
  const totalRepayment = bundleCost + serviceFee;

  return { bundleCost, serviceFee, totalRepayment };
}
