// approve_grow_pack
//
// Cooperative officer reviews a `Requested` Grow Pack and approves it.
// Pure status transition: Requested → Approved. The 48-hour human review
// window is enforced off-chain by the cooperative workflow, not on-chain.

use anchor_lang::prelude::*;

use crate::error::VunaError;
use crate::state::*;

#[derive(Accounts)]
pub struct ApproveGrowPack<'info> {
    #[account(
        mut,
        has_one = farmer,
    )]
    pub pack: Account<'info, GrowPack>,

    #[account(
        has_one = cooperative @ VunaError::UnauthorizedCooperative,
    )]
    pub farmer: Account<'info, FarmerAccount>,

    pub cooperative: Signer<'info>,
}

pub fn handler(ctx: Context<ApproveGrowPack>) -> Result<()> {
    let pack = &mut ctx.accounts.pack;

    require!(
        pack.status == GrowPackStatus::Requested,
        VunaError::InvalidGrowPackStatus
    );

    pack.status = GrowPackStatus::Approved;

    msg!(
        "approve_grow_pack: farmer={} season={}",
        ctx.accounts.farmer.key(),
        pack.season_id,
    );
    Ok(())
}
