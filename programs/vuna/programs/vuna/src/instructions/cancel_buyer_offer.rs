// cancel_buyer_offer — Phase 3 marketplace.
//
// The original buyer takes their offer down. The PDA is closed and
// rent is refunded to the buyer.
//
// Anchor enforces:
//   - The signer is `offer.buyer` via `has_one = buyer`
//   - The PDA seeds match (so we can't be tricked with a different account)
//   - `close = buyer` transfers all lamports back to the buyer at the
//     end of the instruction.

use anchor_lang::prelude::*;

use crate::constants::OFFER_SEED;
use crate::state::BuyerOffer;

#[derive(Accounts)]
pub struct CancelBuyerOffer<'info> {
    #[account(
        mut,
        seeds = [
            OFFER_SEED,
            offer.buyer.as_ref(),
            &offer.offer_id.to_le_bytes(),
        ],
        bump = offer.bump,
        has_one = buyer,
        close = buyer,
    )]
    pub offer: Account<'info, BuyerOffer>,

    #[account(mut)]
    pub buyer: Signer<'info>,
}

pub fn handler(ctx: Context<CancelBuyerOffer>) -> Result<()> {
    msg!(
        "cancel_buyer_offer: buyer={} offer_id={}",
        ctx.accounts.offer.buyer,
        ctx.accounts.offer.offer_id,
    );
    Ok(())
}
