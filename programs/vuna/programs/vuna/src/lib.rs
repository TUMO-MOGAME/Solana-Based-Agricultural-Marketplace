// Project Vuna — Solana program entrypoint.
//
// On-chain accounts:
//   FarmerAccount (PDA): one per farmer per cooperative.
//   GrowPack (PDA):      one per farmer per season.
//
// Instructions, in lifecycle order:
//   register_farmer            cooperative onboards a farmer
//   request_grow_pack          cooperative submits a Grow Pack request
//   approve_grow_pack          cooperative approves the request
//   disburse_grow_pack         inputs delivered; insurance becomes active
//   trigger_insurance_payout   oracle attests drought and records payout
//   settle_repayment           harvest sale closes out the pack

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("7LUkUHVazSw732334JKFP88VAFc4iYXXJZkgFnZV9kqA");

#[program]
pub mod vuna {
    use super::*;

    pub fn register_farmer(
        ctx: Context<RegisterFarmer>,
        farmer_id_hash: [u8; 32],
        region: u8,
    ) -> Result<()> {
        instructions::register_farmer::handler(ctx, farmer_id_hash, region)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn request_grow_pack(
        ctx: Context<RequestGrowPack>,
        season_id: u32,
        seed_cost: u64,
        fertilizer_cost: u64,
        insurance_cost: u64,
        service_fee_bps: u16,
        threshold_percent: u8,
        max_payout: u64,
    ) -> Result<()> {
        instructions::request_grow_pack::handler(
            ctx,
            season_id,
            seed_cost,
            fertilizer_cost,
            insurance_cost,
            service_fee_bps,
            threshold_percent,
            max_payout,
        )
    }

    pub fn approve_grow_pack(ctx: Context<ApproveGrowPack>) -> Result<()> {
        instructions::approve_grow_pack::handler(ctx)
    }

    pub fn disburse_grow_pack(ctx: Context<DisburseGrowPack>) -> Result<()> {
        instructions::disburse_grow_pack::handler(ctx)
    }

    pub fn trigger_insurance_payout(
        ctx: Context<TriggerInsurancePayout>,
        rainfall_percent_of_norm: u8,
    ) -> Result<()> {
        instructions::trigger_insurance_payout::handler(ctx, rainfall_percent_of_norm)
    }

    pub fn settle_repayment(
        ctx: Context<SettleRepayment>,
        sale_proceeds: u64,
    ) -> Result<()> {
        instructions::settle_repayment::handler(ctx, sale_proceeds)
    }

    // ---- Marketplace (Phase 2 — Deal escrow) ----

    pub fn create_deal(
        ctx: Context<CreateDeal>,
        deal_id: u64,
        amount_lamports: u64,
    ) -> Result<()> {
        instructions::create_deal::handler(ctx, deal_id, amount_lamports)
    }

    pub fn confirm_and_release(ctx: Context<ConfirmAndRelease>) -> Result<()> {
        instructions::confirm_and_release::handler(ctx)
    }
}
