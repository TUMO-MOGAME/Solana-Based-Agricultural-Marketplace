// register_farmer
//
// Creates a FarmerAccount PDA when a cooperative registers a smallholder.
// Idempotent per (cooperative, farmer_id_hash) — the PDA seeding prevents
// duplicate registration.

use anchor_lang::prelude::*;

use crate::constants::FARMER_SEED;
use crate::state::*;

#[derive(Accounts)]
#[instruction(farmer_id_hash: [u8; 32])]
pub struct RegisterFarmer<'info> {
    #[account(
        init,
        payer = cooperative,
        space = 8 + FarmerAccount::INIT_SPACE,
        seeds = [FARMER_SEED, cooperative.key().as_ref(), farmer_id_hash.as_ref()],
        bump,
    )]
    pub farmer: Account<'info, FarmerAccount>,

    #[account(mut)]
    pub cooperative: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterFarmer>,
    farmer_id_hash: [u8; 32],
    region: u8,
) -> Result<()> {
    let cooperative_key = ctx.accounts.cooperative.key();
    let bump = ctx.bumps.farmer;

    ctx.accounts.farmer.set_inner(FarmerAccount::new_default(
        cooperative_key,
        farmer_id_hash,
        region,
        bump,
    ));

    msg!(
        "register_farmer: cooperative={} region={} score={}",
        cooperative_key,
        region,
        ctx.accounts.farmer.score,
    );
    Ok(())
}
