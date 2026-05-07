// request_grow_pack
//
// Cooperative submits a Grow Pack application on behalf of a registered farmer.
// Pricing math (bundle_cost / service_fee / total_repayment) lives in
// `GrowPack::quote` (state.rs) so it can be unit-tested directly and so the
// frontend can preview the same numbers before submitting.
//
// Insurance-policy parameters (threshold_percent, max_payout) are recorded but
// not yet validated against the parametric tier rules. Step 4 of the porting
// plan ports `core/parametric.ts` and tightens that.

use anchor_lang::prelude::*;

use crate::constants::GROW_PACK_SEED;
use crate::error::VunaError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(season_id: u32)]
pub struct RequestGrowPack<'info> {
    #[account(
        init,
        payer = cooperative,
        space = 8 + GrowPack::INIT_SPACE,
        seeds = [GROW_PACK_SEED, farmer.key().as_ref(), &season_id.to_le_bytes()],
        bump,
    )]
    pub pack: Account<'info, GrowPack>,

    #[account(
        has_one = cooperative @ VunaError::UnauthorizedCooperative,
    )]
    pub farmer: Account<'info, FarmerAccount>,

    #[account(mut)]
    pub cooperative: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<RequestGrowPack>,
    season_id: u32,
    seed_cost: u64,
    fertilizer_cost: u64,
    insurance_cost: u64,
    service_fee_bps: u16,
    threshold_percent: u8,
    max_payout: u64,
) -> Result<()> {
    // Insurance policy parameter validation. Parametric tier math is added
    // in step 4 (port of core/parametric.ts).
    require!(
        threshold_percent > 0 && threshold_percent <= 100,
        VunaError::InvalidThresholdPercent
    );

    // Pricing math + service-fee-bps validation is delegated to
    // GrowPack::quote so it stays unit-testable.
    let quote = GrowPack::quote(&GrowPackPricing {
        seed_cost,
        fertilizer_cost,
        insurance_cost,
        service_fee_bps,
    })?;

    let pack = &mut ctx.accounts.pack;
    pack.farmer = ctx.accounts.farmer.key();
    pack.season_id = season_id;
    pack.status = GrowPackStatus::Requested;

    pack.seed_cost = seed_cost;
    pack.fertilizer_cost = fertilizer_cost;
    pack.insurance_cost = insurance_cost;
    pack.service_fee_bps = service_fee_bps;
    pack.bundle_cost = quote.bundle_cost;
    pack.service_fee = quote.service_fee;
    pack.total_repayment = quote.total_repayment;

    pack.threshold_percent = threshold_percent;
    pack.max_payout = max_payout;

    pack.rainfall_percent_of_norm = 0;
    pack.insurance_payout = 0;
    pack.sale_proceeds = 0;
    pack.repaid = 0;
    pack.surplus = 0;
    pack.defaulted = 0;
    pack.bump = ctx.bumps.pack;

    msg!(
        "request_grow_pack: season={} bundle={} fee={} repay={}",
        season_id,
        quote.bundle_cost,
        quote.service_fee,
        quote.total_repayment,
    );
    Ok(())
}
