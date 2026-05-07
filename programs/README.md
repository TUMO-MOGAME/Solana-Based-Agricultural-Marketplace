# programs/

Solana / Anchor smart contracts for Project Vuna.

## Status

Scaffold. Not yet initialised.

## Setup (first time)

```bash
# from project root
cd programs
anchor init vuna
```

This creates `Anchor.toml`, `Cargo.toml`, and a `vuna/` workspace with a placeholder lib.rs. Re-read `CLAUDE.md` here for the contract specs.

## Run

```bash
anchor build
anchor test            # localnet
anchor deploy --provider.cluster devnet
```

See `docs/architecture.md` for the program design.
