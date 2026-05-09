// Constants for the Vuna program.
// Numeric values mirror core/credit-score.ts and core/grow-pack.ts.

use anchor_lang::prelude::*;

// ---- PDA seed prefixes ----
pub const FARMER_SEED: &[u8] = b"farmer";
pub const GROW_PACK_SEED: &[u8] = b"pack";
pub const DEAL_SEED: &[u8] = b"deal";
pub const OFFER_SEED: &[u8] = b"offer";

// ---- Credit-score parameters (mirror core/credit-score.ts) ----
#[constant]
pub const SCORE_MIN: u16 = 300;
#[constant]
pub const SCORE_MAX: u16 = 850;
#[constant]
pub const SCORE_INITIAL: u16 = 600;

pub const DELTA_REPAYMENT: i32 = 20;
pub const DELTA_DEFAULT: i32 = -100;
pub const DELTA_INSURANCE: i32 = 0;

// ---- Grow Pack parameters (mirror core/grow-pack.ts) ----
#[constant]
pub const SERVICE_FEE_BPS_DEFAULT: u16 = 1_000; // 10%
pub const BPS_DENOMINATOR: u64 = 10_000;
