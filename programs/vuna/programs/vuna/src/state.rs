// On-chain account types for the Vuna program.
//
// FarmerAccount and GrowPack are PDAs:
//   farmer: ["farmer", cooperative.key, farmer_id_hash]
//   pack:   ["pack", farmer.key, season_id]
//
// All money fields are whole-Rand integers, matching core/grow-pack.ts.
// We never store farmer PII on-chain; only `farmer_id_hash` (a 32-byte hash
// of the underlying PII) appears here.

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::VunaError;

/// A credit-affecting event that occurred at the close of a Grow Pack.
/// Mirrors `CreditEvent` in core/types.ts.
///
/// Not stored on-chain — used only at the boundary between settlement
/// instructions and `FarmerAccount::apply_event`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CreditEvent {
    /// Pack closed with full repayment from harvest sale (no insurance fired).
    SuccessfulRepayment,
    /// Pack closed with insufficient repayment.
    Default,
    /// Pack closed via insurance payout — score is preserved (drought wasn't
    /// the farmer's fault).
    InsuranceTriggered,
}

#[account]
#[derive(InitSpace)]
pub struct FarmerAccount {
    /// The cooperative that registered this farmer. Must sign all mutations.
    pub cooperative: Pubkey,
    /// Hash of farmer PII (name, ID number, phone). PII is stored off-chain
    /// (POPIA) — we only commit a binding hash on-chain.
    pub farmer_id_hash: [u8; 32],
    /// Region code matching core/types.ts Region enum index.
    pub region: u8,
    /// Current credit score, bounded to [SCORE_MIN, SCORE_MAX].
    pub score: u16,
    /// Lifetime counters used to derive the score history hash later.
    pub total_packs: u32,
    pub successful_repayments: u32,
    pub defaults: u32,
    pub insurance_triggers: u32,
    /// PDA bump.
    pub bump: u8,
}

impl FarmerAccount {
    /// Construct a fresh FarmerAccount in its initial state.
    /// Used by `register_farmer` and by tests.
    pub fn new_default(
        cooperative: Pubkey,
        farmer_id_hash: [u8; 32],
        region: u8,
        bump: u8,
    ) -> Self {
        Self {
            cooperative,
            farmer_id_hash,
            region,
            score: SCORE_INITIAL,
            total_packs: 0,
            successful_repayments: 0,
            defaults: 0,
            insurance_triggers: 0,
            bump,
        }
    }

    /// Apply a credit event at the close of a Grow Pack.
    /// Mirrors `applyEvent` in core/credit-score.ts.
    ///
    /// - Updates `score` (clamped to [SCORE_MIN, SCORE_MAX]).
    /// - Increments the matching event counter.
    /// - Always increments `total_packs` (= settled packs).
    pub fn apply_event(&mut self, event: CreditEvent) {
        let delta: i32 = match event {
            CreditEvent::SuccessfulRepayment => DELTA_REPAYMENT,
            CreditEvent::Default => DELTA_DEFAULT,
            CreditEvent::InsuranceTriggered => DELTA_INSURANCE,
        };

        let next = (self.score as i32) + delta;
        self.score = if next < SCORE_MIN as i32 {
            SCORE_MIN
        } else if next > SCORE_MAX as i32 {
            SCORE_MAX
        } else {
            next as u16
        };

        self.total_packs = self.total_packs.saturating_add(1);

        match event {
            CreditEvent::SuccessfulRepayment => {
                self.successful_repayments = self.successful_repayments.saturating_add(1);
            }
            CreditEvent::Default => {
                self.defaults = self.defaults.saturating_add(1);
            }
            CreditEvent::InsuranceTriggered => {
                self.insurance_triggers = self.insurance_triggers.saturating_add(1);
            }
        }
    }
}

/// Lifecycle of a Grow Pack.
///
/// Requested → Approved → Active → (InsurancePaid|Repaid|Defaulted)
///
/// InsurancePaid is reachable from Active via `trigger_insurance_payout`.
/// From InsurancePaid, the farmer's harvest sale (if any) still settles
/// through `settle_repayment`, transitioning to Repaid or Defaulted.
#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, PartialEq, Eq, Debug)]
pub enum GrowPackStatus {
    Requested,
    Approved,
    Active,
    InsurancePaid,
    Repaid,
    Defaulted,
}

#[account]
#[derive(InitSpace)]
pub struct GrowPack {
    /// The FarmerAccount PDA this pack belongs to.
    pub farmer: Pubkey,
    /// Season identifier (e.g. 2026 for the 2026/27 summer planting).
    pub season_id: u32,
    /// Current lifecycle status.
    pub status: GrowPackStatus,

    // ---- Pricing (whole Rand) ----
    pub seed_cost: u64,
    pub fertilizer_cost: u64,
    pub insurance_cost: u64,
    pub service_fee_bps: u16,
    pub bundle_cost: u64,
    pub service_fee: u64,
    pub total_repayment: u64,

    // ---- Insurance policy params (mirror core/parametric.ts) ----
    pub threshold_percent: u8,
    pub max_payout: u64,

    // ---- Oracle observation (zero until OracleCheck fires) ----
    pub rainfall_percent_of_norm: u8,
    pub insurance_payout: u64,

    // ---- Settlement (zero until repayment settles) ----
    pub sale_proceeds: u64,
    pub repaid: u64,
    pub surplus: u64,
    pub defaulted: u64,

    /// PDA bump.
    pub bump: u8,
}

/// Inputs to `GrowPack::quote`. Mirrors `GrowPackPricing` in core/types.ts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GrowPackPricing {
    pub seed_cost: u64,
    pub fertilizer_cost: u64,
    pub insurance_cost: u64,
    /// Service fee as basis points (1000 = 10%). Must be in [0, 10000].
    pub service_fee_bps: u16,
}

/// Output of `GrowPack::quote`. Mirrors `GrowPackQuote` in core/types.ts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GrowPackQuote {
    pub bundle_cost: u64,
    pub service_fee: u64,
    pub total_repayment: u64,
}

/// Result of settling a Grow Pack at harvest.
/// Mirrors `RepaymentResult` in core/types.ts.
///
/// Invariant for any (available, due):
///   repaid + surplus    == available
///   repaid + defaulted  == due
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RepaymentResult {
    /// How much of the loan was actually collected.
    pub repaid: u64,
    /// Excess returned to the farmer.
    pub surplus: u64,
    /// Outstanding debt that could not be collected.
    pub defaulted: u64,
}

/// A parametric drought-insurance policy. Mirrors `ParametricPolicy` in
/// core/types.ts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ParametricPolicy {
    /// Trigger threshold in percent of regional norm.
    /// Rainfall at or above this means no payout. Must be in (0, 100].
    pub threshold_percent: u8,
    /// Maximum payout in whole Rand.
    pub max_payout: u64,
}

/// Severity tier for a parametric payout. Mirrors `PayoutTier` in core/types.ts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PayoutTier {
    /// No payout (rainfall met or exceeded the policy threshold).
    None,
    /// Mild drought (70–79% of norm). 30% of cover.
    Tier1,
    /// Moderate drought (50–69% of norm). 60% of cover.
    Tier2,
    /// Severe drought (<50% of norm). 80% of cover.
    Tier3,
}

/// Result of evaluating a parametric policy against an observed rainfall.
/// Mirrors `PayoutResult` in core/types.ts (without the human-readable
/// `reason` field — we save the bytes; off-chain code can reconstruct).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PayoutResult {
    pub tier: PayoutTier,
    pub amount: u64,
}

impl ParametricPolicy {
    /// Evaluate a payout for an observed rainfall reading, in percent of
    /// regional norm. Mirrors `evaluatePayout` in core/parametric.ts.
    ///
    /// Returns Ok with `tier == None, amount == 0` when no payout is due.
    /// Returns Err only on invalid policy parameters; rainfall above 100%
    /// is allowed (above-average rainfall just means no payout).
    pub fn evaluate_payout(&self, rainfall_percent_of_norm: u8) -> Result<PayoutResult> {
        require!(
            self.threshold_percent > 0 && self.threshold_percent <= 100,
            VunaError::InvalidThresholdPercent
        );

        // No payout if rainfall met or exceeded the policy threshold.
        if rainfall_percent_of_norm >= self.threshold_percent {
            return Ok(PayoutResult { tier: PayoutTier::None, amount: 0 });
        }

        // Cascading tiers, most-severe first. Tier caps mirror TIERS in
        // core/parametric.ts.
        let (tier, payout_bps): (PayoutTier, u16) = if rainfall_percent_of_norm < 50 {
            (PayoutTier::Tier3, 8_000) // 80% of cover
        } else if rainfall_percent_of_norm < 70 {
            (PayoutTier::Tier2, 6_000) // 60% of cover
        } else if rainfall_percent_of_norm < 80 {
            (PayoutTier::Tier1, 3_000) // 30% of cover
        } else {
            // Defensive: rainfall in [80, threshold) only reachable when
            // threshold > 80. TS treats this as no payout (no tier exists
            // above 80% rainfall). Match that.
            return Ok(PayoutResult { tier: PayoutTier::None, amount: 0 });
        };

        let amount = (self.max_payout as u128)
            .checked_mul(payout_bps as u128)
            .ok_or(VunaError::NumericOverflow)?
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(VunaError::NumericOverflow)? as u64;

        Ok(PayoutResult { tier, amount })
    }
}

impl GrowPack {
    /// Compute the price quote for a Grow Pack.
    /// Mirrors `quoteGrowPack` in core/grow-pack.ts.
    ///
    /// Validation:
    /// - service_fee_bps must be in [0, 10000].
    /// - All cost fields are u64, so non-negativity is enforced by the type
    ///   system (the equivalent TS test cases are unrepresentable in Rust).
    pub fn quote(pricing: &GrowPackPricing) -> Result<GrowPackQuote> {
        require!(
            (pricing.service_fee_bps as u64) <= BPS_DENOMINATOR,
            VunaError::InvalidServiceFeeBps
        );

        let bundle_cost = pricing
            .seed_cost
            .checked_add(pricing.fertilizer_cost)
            .and_then(|v| v.checked_add(pricing.insurance_cost))
            .ok_or(VunaError::NumericOverflow)?;

        // Use u128 for the multiplication so we don't overflow u64.
        let service_fee = (bundle_cost as u128)
            .checked_mul(pricing.service_fee_bps as u128)
            .ok_or(VunaError::NumericOverflow)?
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(VunaError::NumericOverflow)? as u64;

        let total_repayment = bundle_cost
            .checked_add(service_fee)
            .ok_or(VunaError::NumericOverflow)?;

        Ok(GrowPackQuote {
            bundle_cost,
            service_fee,
            total_repayment,
        })
    }

    /// Split available funds at harvest into (repaid, surplus, defaulted).
    /// Mirrors `settleAtHarvest` in core/repayment.ts.
    ///
    /// `available_funds` is whatever can be applied to the loan — typically
    /// harvest sale proceeds + any prior insurance payout. The handler
    /// computes that sum (with overflow checks) before calling this.
    ///
    /// Pure infallible math; u64 inputs guarantee non-negativity.
    pub fn settle_at_harvest(
        available_funds: u64,
        total_repayment_due: u64,
    ) -> RepaymentResult {
        if available_funds >= total_repayment_due {
            RepaymentResult {
                repaid: total_repayment_due,
                surplus: available_funds - total_repayment_due,
                defaulted: 0,
            }
        } else {
            RepaymentResult {
                repaid: available_funds,
                surplus: 0,
                defaulted: total_repayment_due - available_funds,
            }
        }
    }
}

// ============================================================================
//  Tests for FarmerAccount credit-score logic.
//  Mirrors tests/unit/credit-score.test.ts one-for-one.
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// A fresh FarmerAccount for credit-score testing.
    fn fresh() -> FarmerAccount {
        FarmerAccount::new_default(Pubkey::new_unique(), [0u8; 32], 0, 255)
    }

    // ---- starting state ----

    #[test]
    fn new_farmer_starts_at_600() {
        let f = fresh();
        assert_eq!(f.score, SCORE_INITIAL);
        assert_eq!(f.score, 600);
    }

    #[test]
    fn new_farmer_has_zero_history() {
        let f = fresh();
        assert_eq!(f.total_packs, 0);
        assert_eq!(f.successful_repayments, 0);
        assert_eq!(f.defaults, 0);
        assert_eq!(f.insurance_triggers, 0);
    }

    // ---- deltas ----

    #[test]
    fn successful_repayment_adds_20() {
        let mut f = fresh();
        f.apply_event(CreditEvent::SuccessfulRepayment);
        assert_eq!(f.score, 620);
        assert_eq!(f.successful_repayments, 1);
        assert_eq!(f.total_packs, 1);
    }

    #[test]
    fn default_subtracts_100() {
        let mut f = fresh();
        f.apply_event(CreditEvent::Default);
        assert_eq!(f.score, 500);
        assert_eq!(f.defaults, 1);
    }

    #[test]
    fn insurance_triggered_does_not_change_score() {
        let mut f = fresh();
        f.apply_event(CreditEvent::InsuranceTriggered);
        assert_eq!(f.score, 600);
        assert_eq!(f.insurance_triggers, 1);
    }

    #[test]
    fn insurance_triggered_still_increments_total_packs() {
        let mut f = fresh();
        f.apply_event(CreditEvent::InsuranceTriggered);
        assert_eq!(f.total_packs, 1);
    }

    // ---- bounds ----

    #[test]
    fn clamps_to_floor_300_after_multiple_defaults() {
        let mut f = fresh();
        for _ in 0..10 {
            f.apply_event(CreditEvent::Default);
        }
        assert_eq!(f.score, SCORE_MIN);
        assert_eq!(f.score, 300);
    }

    #[test]
    fn clamps_to_ceiling_850_after_many_repayments() {
        let mut f = fresh();
        for _ in 0..50 {
            f.apply_event(CreditEvent::SuccessfulRepayment);
        }
        assert_eq!(f.score, SCORE_MAX);
        assert_eq!(f.score, 850);
    }

    // ---- realistic farmer journeys ----

    #[test]
    fn three_successful_seasons_in_a_row_gives_60() {
        let mut f = fresh();
        f.apply_event(CreditEvent::SuccessfulRepayment);
        f.apply_event(CreditEvent::SuccessfulRepayment);
        f.apply_event(CreditEvent::SuccessfulRepayment);
        assert_eq!(f.score, 660);
        assert_eq!(f.successful_repayments, 3);
        assert_eq!(f.total_packs, 3);
    }

    #[test]
    fn two_successes_then_drought_preserves_earned_score() {
        let mut f = fresh();
        f.apply_event(CreditEvent::SuccessfulRepayment);
        f.apply_event(CreditEvent::SuccessfulRepayment);
        f.apply_event(CreditEvent::InsuranceTriggered);
        assert_eq!(f.score, 640);
        assert_eq!(f.insurance_triggers, 1);
    }

    #[test]
    fn default_after_good_history_hurts_but_recoverable() {
        let mut f = fresh();
        for _ in 0..5 {
            f.apply_event(CreditEvent::SuccessfulRepayment);
        }
        assert_eq!(f.score, 700);
        f.apply_event(CreditEvent::Default);
        assert_eq!(f.score, 600);
    }

    // ========================================================================
    //  Tests for GrowPack pricing logic.
    //  Mirrors tests/unit/grow-pack.test.ts.
    // ========================================================================

    /// The canonical proposal Grow Pack — 2 ha maize.
    /// Same numbers as `tests/helpers/fixtures.ts::PROPOSAL_PRICING`.
    fn proposal_pricing() -> GrowPackPricing {
        GrowPackPricing {
            seed_cost: 420,
            fertilizer_cost: 1150,
            insurance_cost: 85,
            service_fee_bps: 1000, // 10%
        }
    }

    // ---- canonical proposal numbers ----

    #[test]
    fn proposal_two_ha_maize_grow_pack_totals_1655() {
        let q = GrowPack::quote(&proposal_pricing()).unwrap();
        assert_eq!(q.bundle_cost, 1655);
    }

    #[test]
    fn service_fee_at_10_percent_of_1655_is_165() {
        let q = GrowPack::quote(&proposal_pricing()).unwrap();
        assert_eq!(q.service_fee, 165);
    }

    #[test]
    fn total_repayment_is_1820() {
        let q = GrowPack::quote(&proposal_pricing()).unwrap();
        assert_eq!(q.total_repayment, 1820);
    }

    // ---- arithmetic ----

    #[test]
    fn bundle_cost_is_seeds_plus_fertilizer_plus_insurance() {
        let q = GrowPack::quote(&GrowPackPricing {
            seed_cost: 100,
            fertilizer_cost: 200,
            insurance_cost: 50,
            service_fee_bps: 1000,
        })
        .unwrap();
        assert_eq!(q.bundle_cost, 350);
    }

    #[test]
    fn total_repayment_equals_bundle_plus_fee() {
        let q = GrowPack::quote(&GrowPackPricing {
            seed_cost: 100,
            fertilizer_cost: 200,
            insurance_cost: 50,
            service_fee_bps: 2000, // 20%
        })
        .unwrap();
        assert_eq!(q.bundle_cost + q.service_fee, q.total_repayment);
        assert_eq!(q.service_fee, 70); // 20% of 350
        assert_eq!(q.total_repayment, 420);
    }

    #[test]
    fn zero_service_fee_leaves_bundle_equal_to_total() {
        let q = GrowPack::quote(&GrowPackPricing {
            seed_cost: 500,
            fertilizer_cost: 500,
            insurance_cost: 100,
            service_fee_bps: 0,
        })
        .unwrap();
        assert_eq!(q.service_fee, 0);
        assert_eq!(q.total_repayment, q.bundle_cost);
    }

    #[test]
    fn default_service_fee_bps_constant_is_1000() {
        assert_eq!(SERVICE_FEE_BPS_DEFAULT, 1000);
    }

    // ---- validation ----
    //
    // Two TS cases — "rejects negative seed cost" and "rejects negative service
    // fee bps" — are unrepresentable in Rust because seed/fertilizer/insurance
    // costs are u64 and service_fee_bps is u16. The type system enforces
    // non-negativity at compile time.

    #[test]
    fn rejects_service_fee_above_100_percent() {
        let result = GrowPack::quote(&GrowPackPricing {
            seed_cost: 100,
            fertilizer_cost: 100,
            insurance_cost: 100,
            service_fee_bps: 10_001,
        });
        assert!(result.is_err(), "expected an error for bps > 10000");
    }

    // ---- rounding ----

    #[test]
    fn service_fee_floors_fractional_cents() {
        // 333 * 1000 / 10000 = 33.3 → 33
        let q = GrowPack::quote(&GrowPackPricing {
            seed_cost: 333,
            fertilizer_cost: 0,
            insurance_cost: 0,
            service_fee_bps: 1000,
        })
        .unwrap();
        assert_eq!(q.service_fee, 33);
        assert_eq!(q.total_repayment, 366);
    }

    // ========================================================================
    //  Tests for ParametricPolicy::evaluate_payout
    //  Mirrors tests/unit/parametric.test.ts.
    // ========================================================================

    /// Default drought policy from the proposal: trigger at 80%, cover R 1 750.
    /// Same numbers as `tests/helpers/fixtures.ts::DEFAULT_POLICY`.
    fn default_policy() -> ParametricPolicy {
        ParametricPolicy {
            threshold_percent: 80,
            max_payout: 1750,
        }
    }

    // ---- no-payout cases ----

    #[test]
    fn rainfall_above_threshold_no_payout() {
        let r = default_policy().evaluate_payout(95).unwrap();
        assert_eq!(r.tier, PayoutTier::None);
        assert_eq!(r.amount, 0);
    }

    #[test]
    fn rainfall_at_threshold_no_payout_boundary_inclusive() {
        let r = default_policy().evaluate_payout(80).unwrap();
        assert_eq!(r.tier, PayoutTier::None);
        assert_eq!(r.amount, 0);
    }

    #[test]
    fn rainfall_at_100_no_payout() {
        let r = default_policy().evaluate_payout(100).unwrap();
        assert_eq!(r.tier, PayoutTier::None);
    }

    // ---- tier 1 (mild drought, 30% payout) ----

    #[test]
    fn rainfall_79_is_tier1() {
        let r = default_policy().evaluate_payout(79).unwrap();
        assert_eq!(r.tier, PayoutTier::Tier1);
        assert_eq!(r.amount, 525); // 30% of 1750
    }

    #[test]
    fn rainfall_70_is_tier1_just_above_tier2_boundary() {
        let r = default_policy().evaluate_payout(70).unwrap();
        assert_eq!(r.tier, PayoutTier::Tier1);
    }

    // ---- tier 2 (moderate drought, 60% payout) ----

    #[test]
    fn rainfall_69_is_tier2() {
        let r = default_policy().evaluate_payout(69).unwrap();
        assert_eq!(r.tier, PayoutTier::Tier2);
        assert_eq!(r.amount, 1050); // 60% of 1750
    }

    #[test]
    fn rainfall_50_is_tier2_just_above_tier3_boundary() {
        let r = default_policy().evaluate_payout(50).unwrap();
        assert_eq!(r.tier, PayoutTier::Tier2);
    }

    // ---- tier 3 (severe drought, 80% payout) ----

    #[test]
    fn rainfall_49_is_tier3() {
        let r = default_policy().evaluate_payout(49).unwrap();
        assert_eq!(r.tier, PayoutTier::Tier3);
        assert_eq!(r.amount, 1400); // 80% of 1750
    }

    #[test]
    fn rainfall_0_is_tier3_worst_case() {
        let r = default_policy().evaluate_payout(0).unwrap();
        assert_eq!(r.tier, PayoutTier::Tier3);
        assert_eq!(r.amount, 1400);
    }

    /// The exact scenario shown on the mockup's drought-payout screen:
    /// 32mm out of 80mm expected = 40% of norm → R 1 400 payout.
    #[test]
    fn proposal_quoted_scenario_40_percent_pays_1400() {
        let r = default_policy().evaluate_payout(40).unwrap();
        assert_eq!(r.tier, PayoutTier::Tier3);
        assert_eq!(r.amount, 1400);
    }

    // ---- validation ----
    //
    // TS tests for negative rainfall, NaN rainfall, infinite rainfall, and
    // negative max_payout are unrepresentable in Rust (rainfall is u8,
    // max_payout is u64).

    #[test]
    fn rejects_threshold_zero() {
        let p = ParametricPolicy { threshold_percent: 0, max_payout: 1000 };
        assert!(p.evaluate_payout(50).is_err());
    }

    #[test]
    fn rejects_threshold_above_100() {
        let p = ParametricPolicy { threshold_percent: 101, max_payout: 1000 };
        assert!(p.evaluate_payout(50).is_err());
    }

    // ========================================================================
    //  Tests for GrowPack::settle_at_harvest
    //  Mirrors tests/unit/repayment.test.ts.
    // ========================================================================

    // ---- full repayment + surplus ----

    #[test]
    fn sale_exceeds_due_full_repayment_surplus_to_farmer() {
        let r = GrowPack::settle_at_harvest(2500, 1820);
        assert_eq!(r.repaid, 1820);
        assert_eq!(r.surplus, 680);
        assert_eq!(r.defaulted, 0);
    }

    #[test]
    fn sale_equal_to_due_exact_repayment_zero_surplus_zero_default() {
        let r = GrowPack::settle_at_harvest(1820, 1820);
        assert_eq!(r.repaid, 1820);
        assert_eq!(r.surplus, 0);
        assert_eq!(r.defaulted, 0);
    }

    // ---- partial repayment ----

    #[test]
    fn sale_less_than_due_partial_repayment_remainder_defaults() {
        let r = GrowPack::settle_at_harvest(1200, 1820);
        assert_eq!(r.repaid, 1200);
        assert_eq!(r.surplus, 0);
        assert_eq!(r.defaulted, 620);
    }

    #[test]
    fn zero_sale_total_default() {
        let r = GrowPack::settle_at_harvest(0, 1820);
        assert_eq!(r.repaid, 0);
        assert_eq!(r.surplus, 0);
        assert_eq!(r.defaulted, 1820);
    }

    #[test]
    fn sale_of_1_rand_one_repaid_rest_defaults() {
        let r = GrowPack::settle_at_harvest(1, 1820);
        assert_eq!(r.repaid, 1);
        assert_eq!(r.defaulted, 1819);
    }

    // ---- edge cases ----

    #[test]
    fn zero_loan_zero_sale_all_zeros() {
        let r = GrowPack::settle_at_harvest(0, 0);
        assert_eq!(r.repaid, 0);
        assert_eq!(r.surplus, 0);
        assert_eq!(r.defaulted, 0);
    }

    #[test]
    fn zero_loan_positive_sale_all_surplus() {
        let r = GrowPack::settle_at_harvest(500, 0);
        assert_eq!(r.repaid, 0);
        assert_eq!(r.surplus, 500);
        assert_eq!(r.defaulted, 0);
    }

    // ---- the invariant: every Rand is accounted for ----
    //
    // (repaid + surplus) accounts for every Rand the farmer brought in.
    // (repaid + defaulted) accounts for every Rand the platform was owed.
    // Mirrors the parameterised it.each(...) block in TS.

    #[test]
    fn invariant_every_rand_accounted_for() {
        let cases: &[(u64, u64)] = &[
            (2500, 1820),
            (1820, 1820),
            (1200, 1820),
            (0, 1820),
            (500, 0),
            (99_999, 1),
        ];
        for &(available, due) in cases {
            let r = GrowPack::settle_at_harvest(available, due);
            assert_eq!(
                r.repaid + r.surplus,
                available,
                "case (available={}, due={}): repaid+surplus != available",
                available,
                due,
            );
            assert_eq!(
                r.repaid + r.defaulted,
                due,
                "case (available={}, due={}): repaid+defaulted != due",
                available,
                due,
            );
        }
    }
}
