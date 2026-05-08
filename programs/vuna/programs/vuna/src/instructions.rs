// Vuna instruction modules. Each instruction has its own file with the
// Accounts struct and the `handler` function.
//
// We re-export each submodule with a glob — this is what Anchor's `#[program]`
// macro expects, because it looks for the Accounts struct and its synthesised
// `__client_accounts_*` companion module at the crate root.
//
// Every instruction module exports a `handler`; the resulting glob conflict on
// `handler` is *harmless* (the program calls them via fully-qualified paths
// like `instructions::register_farmer::handler`). We silence the warning.

#![allow(ambiguous_glob_reexports)]

pub mod register_farmer;
pub mod request_grow_pack;
pub mod approve_grow_pack;
pub mod disburse_grow_pack;
pub mod trigger_insurance_payout;
pub mod settle_repayment;
pub mod create_deal;
pub mod confirm_and_release;

pub use register_farmer::*;
pub use request_grow_pack::*;
pub use approve_grow_pack::*;
pub use disburse_grow_pack::*;
pub use trigger_insurance_payout::*;
pub use settle_repayment::*;
pub use create_deal::*;
pub use confirm_and_release::*;
