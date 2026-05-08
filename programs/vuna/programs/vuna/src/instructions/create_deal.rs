// create_deal — Phase 2 marketplace escrow.
//
// The buyer locks `amount_lamports` into a Deal PDA. The PDA is seeded by
// (buyer, farmer, deal_id) so multiple concurrent deals are possible.
// Lamports are transferred from buyer → PDA via a System Program CPI; the
// PDA only releases to `farmer` when `confirm_and_release` is called later.
//
// Demo simplification: in production the cooperative would mediate. For
// the hackathon demo, buyer and farmer are the only parties — the farmer
// confirms delivery themselves in `confirm_and_release`.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

use crate::constants::DEAL_SEED;
use crate::error::VunaError;
use crate::state::Deal;

#[derive(Accounts)]
#[instruction(deal_id: u64, amount_lamports: u64)]
pub struct CreateDeal<'info> {
    #[account(
        init,
        payer = buyer,
        space = 8 + Deal::INIT_SPACE,
        seeds = [
            DEAL_SEED,
            buyer.key().as_ref(),
            farmer.key().as_ref(),
            &deal_id.to_le_bytes(),
        ],
        bump,
    )]
    pub deal: Account<'info, Deal>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: read-only — used as a PDA seed and stored in `deal.farmer`.
    /// The farmer does not need to sign at create time; their only
    /// authority is to call `confirm_and_release` later.
    pub farmer: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateDeal>,
    deal_id: u64,
    amount_lamports: u64,
) -> Result<()> {
    require!(amount_lamports > 0, VunaError::InvalidDealAmount);
    require_keys_neq!(
        ctx.accounts.buyer.key(),
        ctx.accounts.farmer.key(),
        VunaError::SelfDeal
    );

    let buyer_key = ctx.accounts.buyer.key();
    let farmer_key = ctx.accounts.farmer.key();
    let bump = ctx.bumps.deal;

    ctx.accounts.deal.set_inner(Deal {
        buyer: buyer_key,
        farmer: farmer_key,
        deal_id,
        amount_lamports,
        created_at: Clock::get()?.unix_timestamp,
        bump,
    });

    // Transfer lamports from buyer → deal PDA. The PDA already has
    // rent-exempt lamports from `init`; this adds the locked amount on top.
    // Using system_instruction::transfer + invoke (rather than the Anchor
    // CpiContext helper) because the CpiContext::new signature changed in
    // anchor-lang 1.x and the lower-level path is stable across versions.
    let ix = system_instruction::transfer(
        &ctx.accounts.buyer.key(),
        &ctx.accounts.deal.key(),
        amount_lamports,
    );
    invoke(
        &ix,
        &[
            ctx.accounts.buyer.to_account_info(),
            ctx.accounts.deal.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    msg!(
        "create_deal: buyer={} farmer={} deal_id={} amount={}",
        buyer_key,
        farmer_key,
        deal_id,
        amount_lamports,
    );
    Ok(())
}
