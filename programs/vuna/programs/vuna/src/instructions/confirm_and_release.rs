// confirm_and_release — Phase 2 marketplace escrow.
//
// The farmer confirms delivery; the Deal PDA is closed and all its
// lamports (rent + locked amount) are transferred to the farmer.
//
// Anchor's `close = farmer` directive handles the actual transfer +
// account rent reclaim atomically, so the handler body is small. The
// Accounts struct enforces the rules:
//   - The named farmer must sign.
//   - The Deal PDA must match its stored (buyer, farmer, deal_id).
//   - The PDA's `farmer` field equals the signer (`has_one = farmer`).
//
// Demo simplification: in production this would also require a
// cooperative co-signer. For the hackathon demo we keep one signer.

use anchor_lang::prelude::*;

use crate::constants::DEAL_SEED;
use crate::state::Deal;

#[derive(Accounts)]
pub struct ConfirmAndRelease<'info> {
    #[account(
        mut,
        seeds = [
            DEAL_SEED,
            deal.buyer.as_ref(),
            deal.farmer.as_ref(),
            &deal.deal_id.to_le_bytes(),
        ],
        bump = deal.bump,
        has_one = farmer,
        close = farmer,
    )]
    pub deal: Account<'info, Deal>,

    #[account(mut)]
    pub farmer: Signer<'info>,
}

pub fn handler(ctx: Context<ConfirmAndRelease>) -> Result<()> {
    msg!(
        "confirm_and_release: buyer={} farmer={} deal_id={} amount={}",
        ctx.accounts.deal.buyer,
        ctx.accounts.deal.farmer,
        ctx.accounts.deal.deal_id,
        ctx.accounts.deal.amount_lamports,
    );
    // No mutation needed — Anchor's `close = farmer` directive transfers
    // the PDA's lamports (rent + locked amount) to the farmer at the end
    // of the instruction.
    Ok(())
}
