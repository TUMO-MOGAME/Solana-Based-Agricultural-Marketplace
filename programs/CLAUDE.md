# programs/ — CLAUDE context

Solana / Anchor on-chain code lives here.

## Status

Empty scaffold. We initialise it with `anchor init vuna` when we start coding.

## What we are building

See `docs/architecture.md` for the full spec. In short:

| Program | Purpose |
|-|-|
| `FarmerAccount` (PDA) | Farmer identity hash, region, credit-history root, score |
| `GrowPack` | Locks credit, registers insurance policy, tracks state |
| `OracleCheck` | Reads Pyth weather, fires payout if rainfall < threshold |
| `Repayment` | Deducts at harvest sale, updates score |
| `CreditScore` | Read-only view; deterministic over history |

## Rules

- **No PII on-chain.** Hashes only. PII stays in PostgreSQL under POPIA controls.
- **PDAs everywhere.** No client-controlled keypairs for state accounts.
- **Pyth is the only oracle for money flow.** Anything else (harvest verification, delivery confirmation) uses off-chain attestation.
- **Test on devnet. Audit before mainnet.** No real money on mainnet without an external audit and bug bounty.
- **Pause authority on critical paths.** Smart contracts must be pause-able by an admin in case of exploit. Document the pause key custody plan.
- **Programs are upgradeable** during pilot. Plan to renounce upgrade authority after audit + first mainnet quarter.

## Critical path

Validate Pyth weather feeds on devnet first. If we cannot get reliable per-region rainfall data, the entire insurance product collapses. Do this before writing any other contract.

## When you start

```bash
cd programs
anchor init vuna --javascript    # or --typescript when we settle on it
```

Then update this file's "Status" section.
