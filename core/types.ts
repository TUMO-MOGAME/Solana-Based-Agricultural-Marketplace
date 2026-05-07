// Shared types for core business logic.
// All money is whole Rand (integer). No floats for currency.

export type Crop = "maize" | "wheat" | "soybean" | "sorghum" | "beans";

export type Region =
  | "eastern_cape"
  | "kwazulu_natal"
  | "limpopo"
  | "mpumalanga"
  | "free_state"
  | "north_west"
  | "western_cape"
  | "northern_cape"
  | "gauteng";

export type GrowPackStatus =
  | "requested"
  | "approved"
  | "disbursed"
  | "active"
  | "insurance_paid"
  | "repaid"
  | "defaulted";

export interface GrowPackPricing {
  /** Cost of certified seed in whole Rand. */
  seedCost: number;
  /** Cost of fertilizer in whole Rand. */
  fertilizerCost: number;
  /** Cost of parametric insurance premium in whole Rand. */
  insuranceCost: number;
  /** Service fee as basis points (e.g. 1000 = 10%). */
  serviceFeeBps: number;
}

export interface GrowPackQuote {
  bundleCost: number;       // seeds + fertilizer + insurance
  serviceFee: number;       // bundleCost * serviceFeeBps / 10_000
  totalRepayment: number;   // bundleCost + serviceFee
}

export interface ParametricPolicy {
  /** Threshold in percent of regional norm (e.g. 70 means trigger fires below 70%). */
  thresholdPercent: number;
  /** Maximum payout in whole Rand. */
  maxPayout: number;
}

export type PayoutTier = "none" | "tier1" | "tier2" | "tier3";

export interface PayoutResult {
  tier: PayoutTier;
  amount: number;       // whole Rand
  reason: string;       // human-readable explanation
}

export interface RepaymentResult {
  /** How much of the loan was actually repaid. */
  repaid: number;
  /** Surplus returned to the farmer. */
  surplus: number;
  /** Outstanding default (zero on full repayment). */
  defaulted: number;
}

export type CreditEvent =
  | { kind: "successful_repayment" }
  | { kind: "default" }
  | { kind: "insurance_triggered" };

export interface CreditScoreState {
  score: number;
  totalPacks: number;
  successfulRepayments: number;
  defaults: number;
  insuranceTriggers: number;
}
