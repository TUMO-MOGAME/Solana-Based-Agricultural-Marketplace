# Glossary

Project Vuna vocabulary. Add new terms as we coin them.

## Product

- **Vuna** — *Verb,* "to harvest" in isiZulu and isiXhosa. The product name.
- **Grow Pack** — Our flagship bundled product: certified seeds + fertilizer + parametric drought insurance, delivered on credit, repaid at harvest.
- **Credit history (on-chain)** — A portable, append-only record of a farmer's loan + repayment behaviour. Readable by other lenders.

## Partners

- **Cooperative / co-op** — Local farmer organisation. Handles registration, KYC, and on-the-ground trust. The mediation layer between Vuna and the farmer.
- **Extension officer** — Government-employed agricultural advisor. Often a co-op's link to formal services.
- **Off-taker** — Buyer who purchases the harvest. Often a co-op or aggregator. Sale flows through the marketplace, repayment is auto-deducted.

## Financial / regulatory

- **Parametric insurance** — Insurance that pays out based on a measurable parameter (e.g. rainfall < 50mm), not on a claims investigation. Cheaper to operate, faster to pay.
- **CASP** — Crypto Asset Service Provider. The FSCA licence required to handle crypto.
- **NCR** — National Credit Regulator. Licenses lenders.
- **FSCA** — Financial Sector Conduct Authority. Licenses CASPs and FSPs.
- **FSP** — Financial Service Provider (FAIS Act licence). Required to sell insurance.
- **SARB** — South African Reserve Bank. Owns exchange-control regulation.
- **POPIA** — Protection of Personal Information Act. Privacy law.
- **PAPSS** — Pan-African Payment and Settlement System. The continental cross-border rail.
- **PayShap** — South Africa's instant domestic payment rail.
- **MFI** — Microfinance Institution.

## Technical

- **PDA** — Program Derived Address. A Solana account address derived deterministically from seeds, controlled by a program rather than a private key.
- **Anchor** — Solana's standard smart-contract framework, in Rust.
- **Pyth** — On-chain oracle network. Provides weather and price data.
- **Crank** — Off-chain process that periodically calls an on-chain instruction (e.g. our `OracleCheck`).
- **Stablecoin** — Token pegged to a fiat value. We use USDC (USD-pegged) until ZAR-pegged options mature.
- **Custodial wallet** — Wallet where Vuna holds the keys on the farmer's behalf. Required because farmers cannot manage seed phrases.
