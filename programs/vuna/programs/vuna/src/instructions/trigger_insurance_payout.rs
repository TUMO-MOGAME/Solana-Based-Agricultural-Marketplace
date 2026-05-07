// trigger_insurance_payout
//
// Records a rainfall observation against an active Grow Pack and, if the
// observation breaches the policy threshold, transitions the pack to
// InsurancePaid and stores the computed payout amount.
//
// The caller provides ONLY `rainfall_percent_of_norm`. The on-chain program
// computes the payout amount itself using `ParametricPolicy::evaluate_payout`,
// so the caller cannot pass an inflated payout figure. This is the right
// defensible default for the hackathon demo.
//
// In production, when an FSP-licensed underwriter is in the loop (per the
// Insurance Act 2017), an additional `attest_insurance_payout` instruction
// will accept a signed underwriter attestation as the source of truth and
// skip the on-chain rule check. Both instruction paths can coexist.

use anchor_lang::prelude::*;

use crate::error::VunaError;
use crate::state::*;

#[derive(Accounts)]
pub struct TriggerInsurancePayout<'info> {
    #[account(
        mut,
        has_one = farmer,
    )]
    pub pack: Account<'info, GrowPack>,

    /// Read-only at this stage: counter updates happen at settlement via
    /// `FarmerAccount::apply_event`, not when the trigger fires.
    #[account(
        has_one = cooperative @ VunaError::UnauthorizedCooperative,
    )]
    pub farmer: Account<'info, FarmerAccount>,

    /// In step 1 we accept the cooperative as the attesting signer. When the
    /// underwriter integration lands, this becomes the underwriter's signing
    /// service.
    pub cooperative: Signer<'info>,
}

pub fn handler(
    ctx: Context<TriggerInsurancePayout>,
    rainfall_percent_of_norm: u8,
) -> Result<()> {
    let pack = &mut ctx.accounts.pack;
    require!(
        pack.status == GrowPackStatus::Active,
        VunaError::InvalidGrowPackStatus
    );

    let policy = ParametricPolicy {
        threshold_percent: pack.threshold_percent,
        max_payout: pack.max_payout,
    };
    let result = policy.evaluate_payout(rainfall_percent_of_norm)?;

    // Always record the observation, even when no payout fires — useful for
    // historical analysis and to show "we checked, nothing was due".
    pack.rainfall_percent_of_norm = rainfall_percent_of_norm;
    pack.insurance_payout = result.amount;

    if result.tier != PayoutTier::None {
        pack.status = GrowPackStatus::InsurancePaid;
    }

    msg!(
        "trigger_insurance_payout: rainfall={}% tier={:?} payout={}",
        rainfall_percent_of_norm,
        result.tier,
        result.amount,
    );
    Ok(())
}
