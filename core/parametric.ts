// Parametric insurance trigger and payout calculation.
// Three tiers; thresholds applied against the policy's headline `thresholdPercent`.

import type { ParametricPolicy, PayoutResult, PayoutTier } from "./types.js";

// Tier definitions, expressed as (max rainfall % of norm, payout fraction in basis points).
// They cascade from least severe (tier1) to most severe (tier3).
const TIERS: ReadonlyArray<{ tier: PayoutTier; rainfallCap: number; payoutBps: number }> = [
  { tier: "tier1", rainfallCap: 80, payoutBps: 3000 }, // 70-79% → 30%
  { tier: "tier2", rainfallCap: 70, payoutBps: 6000 }, // 50-69% → 60%
  { tier: "tier3", rainfallCap: 50, payoutBps: 8000 }, //   <50% → 80%
];

export function evaluatePayout(
  rainfallPercentOfNorm: number,
  policy: ParametricPolicy,
): PayoutResult {
  if (!Number.isFinite(rainfallPercentOfNorm) || rainfallPercentOfNorm < 0) {
    throw new Error("rainfallPercentOfNorm must be a non-negative finite number");
  }
  if (policy.thresholdPercent <= 0 || policy.thresholdPercent > 100) {
    throw new Error("policy thresholdPercent must be in (0, 100]");
  }
  if (policy.maxPayout < 0) {
    throw new Error("policy maxPayout must be non-negative");
  }

  // No payout if rainfall is at or above the policy's headline threshold.
  if (rainfallPercentOfNorm >= policy.thresholdPercent) {
    return {
      tier: "none",
      amount: 0,
      reason: `Rainfall ${rainfallPercentOfNorm}% met or exceeded threshold ${policy.thresholdPercent}%.`,
    };
  }

  // Walk the tiers from most-severe down to find the deepest applicable.
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const t = TIERS[i]!;
    if (rainfallPercentOfNorm < t.rainfallCap) {
      const amount = Math.floor((policy.maxPayout * t.payoutBps) / 10_000);
      return {
        tier: t.tier,
        amount,
        reason: `Rainfall ${rainfallPercentOfNorm}% below ${t.rainfallCap}% trigger; ${t.payoutBps / 100}% of cover.`,
      };
    }
  }

  // Defensive fallback — unreachable if TIERS includes a 80% cap and threshold ≤ 100.
  return {
    tier: "none",
    amount: 0,
    reason: "Rainfall above all tier thresholds.",
  };
}
