// disburse_grow_pack
//
// Inputs have been delivered to the farmer (off-chain, by suppliers under
// cooperative oversight). Cooperative confirms delivery; pack transitions
// Approved → Active. The insurance policy goes live from this moment.
//
// Real input-delivery proof (supplier signature) is enforced off-chain by
// the cooperative workflow, not on-chain.

use anchor_lang::prelude::*;

use crate::error::VunaError;
use crate::state::*;

#[derive(Accounts)]
pub struct DisburseGrowPack<'info> {
    #[account(
        mut,
        has_one = farmer,
    )]
    pub pack: Account<'info, GrowPack>,

    /// Read-only at this stage: total_packs is incremented at settlement,
    /// not at disbursement (mirrors core/credit-score.ts where applyEvent
    /// is called once per closed pack).
    #[account(
        has_one = cooperative @ VunaError::UnauthorizedCooperative,
    )]
    pub farmer: Account<'info, FarmerAccount>,

    pub cooperative: Signer<'info>,
}

pub fn handler(ctx: Context<DisburseGrowPack>) -> Result<()> {
    let pack = &mut ctx.accounts.pack;

    require!(
        pack.status == GrowPackStatus::Approved,
        VunaError::InvalidGrowPackStatus
    );

    pack.status = GrowPackStatus::Active;

    msg!(
        "disburse_grow_pack: farmer={} season={} (insurance now active)",
        ctx.accounts.farmer.key(),
        pack.season_id,
    );
    Ok(())
}
