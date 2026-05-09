// post_buyer_offer — Phase 3 marketplace.
//
// A buyer posts an on-chain offer (crop, region, max tons, R/ton, expiry).
// The offer is stored at a PDA seeded by ("offer", buyer, offer_id) and
// any farmer can discover it via getProgramAccounts. Multiple concurrent
// offers from the same buyer are supported by varying offer_id.
//
// Validation:
//   - max_quantity_tons > 0
//   - price_per_ton_zar > 0
//   - expires_at strictly in the future (vs Solana clock)
//
// `middleman_price_zar` may legitimately be zero (no comparison
// available); the marketplace UI just hides the savings badge in
// that case.

use anchor_lang::prelude::*;

use crate::constants::OFFER_SEED;
use crate::error::VunaError;
use crate::state::BuyerOffer;

#[derive(Accounts)]
#[instruction(offer_id: u64)]
pub struct PostBuyerOffer<'info> {
    #[account(
        init,
        payer = buyer,
        space = 8 + BuyerOffer::INIT_SPACE,
        seeds = [
            OFFER_SEED,
            buyer.key().as_ref(),
            &offer_id.to_le_bytes(),
        ],
        bump,
    )]
    pub offer: Account<'info, BuyerOffer>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<PostBuyerOffer>,
    offer_id: u64,
    crop: u8,
    region: u8,
    buyer_type: u8,
    max_quantity_tons: u32,
    price_per_ton_zar: u64,
    middleman_price_zar: u64,
    expires_at: i64,
    buyer_name: [u8; 32],
) -> Result<()> {
    require!(max_quantity_tons > 0, VunaError::InvalidOfferQuantity);
    require!(price_per_ton_zar > 0, VunaError::InvalidOfferPrice);
    let now = Clock::get()?.unix_timestamp;
    require!(expires_at > now, VunaError::InvalidOfferExpiry);

    let buyer_key = ctx.accounts.buyer.key();
    let bump = ctx.bumps.offer;

    ctx.accounts.offer.set_inner(BuyerOffer {
        buyer: buyer_key,
        offer_id,
        crop,
        region,
        buyer_type,
        max_quantity_tons,
        price_per_ton_zar,
        middleman_price_zar,
        created_at: now,
        expires_at,
        buyer_name,
        bump,
    });

    msg!(
        "post_buyer_offer: buyer={} offer_id={} crop={} max_tons={} price={} expires={}",
        buyer_key,
        offer_id,
        crop,
        max_quantity_tons,
        price_per_ton_zar,
        expires_at,
    );
    Ok(())
}
