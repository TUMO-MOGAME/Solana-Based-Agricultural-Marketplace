// Vuna program error codes.
// Returned to the client as Anchor errors with stable codes and messages.

use anchor_lang::prelude::*;

#[error_code]
pub enum VunaError {
    #[msg("Grow Pack is not in the expected status for this action")]
    InvalidGrowPackStatus,

    #[msg("Service-fee basis points must be between 0 and 10000 inclusive")]
    InvalidServiceFeeBps,

    #[msg("Threshold percent must be in (0, 100]")]
    InvalidThresholdPercent,

    #[msg("Rainfall percent of norm must be in [0, 100]")]
    InvalidRainfallPercent,

    #[msg("Costs must be non-negative")]
    InvalidCost,

    #[msg("Caller is not the cooperative authorised for this farmer")]
    UnauthorizedCooperative,

    #[msg("Caller is not the authorised oracle attester")]
    UnauthorizedOracle,

    #[msg("Numeric overflow in pricing or score calculation")]
    NumericOverflow,

    // ---- Marketplace (Phase 2 — Deal escrow) ----
    #[msg("Deal amount must be greater than zero")]
    InvalidDealAmount,

    #[msg("Buyer and farmer must be different accounts")]
    SelfDeal,

    // ---- Marketplace (Phase 3 — BuyerOffer) ----
    #[msg("Offer price (R/ton) must be greater than zero")]
    InvalidOfferPrice,

    #[msg("Offer max quantity (tons) must be greater than zero")]
    InvalidOfferQuantity,

    #[msg("Offer expiry must be in the future")]
    InvalidOfferExpiry,
}
