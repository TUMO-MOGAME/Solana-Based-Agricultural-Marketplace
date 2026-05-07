// Shared test fixtures.
// Numbers chosen to mirror the proposal and the mockup screens.

import type { GrowPackPricing, ParametricPolicy } from "@core/types.js";

/** The canonical 2-hectare maize Grow Pack used in the proposal & mockups. */
export const PROPOSAL_PRICING: GrowPackPricing = {
  seedCost: 420,
  fertilizerCost: 1150,
  insuranceCost: 85,
  serviceFeeBps: 1000, // 10%
};

/** Default drought policy used in the proposal: trigger at 80%, cover R 1 750. */
export const DEFAULT_POLICY: ParametricPolicy = {
  thresholdPercent: 80,
  maxPayout: 1750,
};
