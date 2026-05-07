// settle_repayment
//
// Called at harvest sale to close out a Grow Pack. Splits the available funds
// (sale proceeds + any insurance payout already recorded) into:
//   - repaid:    collected against total_repayment
//   - surplus:   returned to the farmer
//   - defaulted: outstanding amount that could not be collected
//
// The pack's terminal status is Repaid (defaulted == 0) or Defaulted.
// The farmer's credit event is determined first by whether insurance fired:
//   - was_insurance_paid → CreditEvent::InsuranceTriggered (score unchanged)
//   - else defaulted > 0 → CreditEvent::Default        (score -= 100)
//   - else                → CreditEvent::SuccessfulRepayment (score += 20)
//
// Score arithmetic + clamping live in `FarmerAccount::apply_event`
// (mirrors core/credit-score.ts and is tested in state.rs).
//
// Step 5 of the porting plan tightens validation around totals and adds
// the 6-case "every Rand accounted for" invariant test.

use anchor_lang::prelude::*;

use crate::error::VunaError;
use crate::state::*;

#[derive(Accounts)]
pub struct SettleRepayment<'info> {
    #[account(
        mut,
        has_one = farmer,
    )]
    pub pack: Account<'info, GrowPack>,

    #[account(
        mut,
        has_one = cooperative @ VunaError::UnauthorizedCooperative,
    )]
    pub farmer: Account<'info, FarmerAccount>,

    pub cooperative: Signer<'info>,
}

pub fn handler(ctx: Context<SettleRepayment>, sale_proceeds: u64) -> Result<()> {
    let pack = &mut ctx.accounts.pack;

    require!(
        pack.status == GrowPackStatus::Active || pack.status == GrowPackStatus::InsurancePaid,
        VunaError::InvalidGrowPackStatus
    );

    let was_insurance_paid = pack.status == GrowPackStatus::InsurancePaid;

    // Total funds available to settle the loan = harvest sale + any prior
    // insurance payout. Overflow check on the sum; the split itself is
    // infallible.
    let available = sale_proceeds
        .checked_add(pack.insurance_payout)
        .ok_or(VunaError::NumericOverflow)?;

    let result = GrowPack::settle_at_harvest(available, pack.total_repayment);

    pack.sale_proceeds = sale_proceeds;
    pack.repaid = result.repaid;
    pack.surplus = result.surplus;
    pack.defaulted = result.defaulted;

    pack.status = if result.defaulted > 0 {
        GrowPackStatus::Defaulted
    } else {
        GrowPackStatus::Repaid
    };

    // Insurance trigger takes precedence: a drought year never damages
    // the farmer's score, even if the harvest also fell short.
    let event = if was_insurance_paid {
        CreditEvent::InsuranceTriggered
    } else if result.defaulted > 0 {
        CreditEvent::Default
    } else {
        CreditEvent::SuccessfulRepayment
    };

    let farmer = &mut ctx.accounts.farmer;
    farmer.apply_event(event);

    msg!(
        "settle_repayment: sale={} insurance={} repaid={} surplus={} defaulted={} event={:?} score={}",
        sale_proceeds,
        pack.insurance_payout,
        result.repaid,
        result.surplus,
        result.defaulted,
        event,
        farmer.score,
    );
    Ok(())
}
