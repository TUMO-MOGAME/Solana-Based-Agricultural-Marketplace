# programs/

Solana / Anchor smart contracts for **Mazra'at albaan** (program crate name: `vuna`).

## Status

✅ **Live on devnet** at `7LUkUHVazSw732334JKFP88VAFc4iYXXJZkgFnZV9kqA`.

The program has 6 instructions covering the full Grow Pack lifecycle (register → request → approve → disburse → trigger insurance payout → settle repayment). 41 cargo unit tests + 3 litesvm integration tests, all passing.

## Run tests

```bash
cd programs/vuna/programs/vuna
cargo test --lib              # 41 host-side unit tests
cargo test --test lifecycle   # 3 in-process litesvm integration tests
```

## Build

```bash
cd programs/vuna/programs/vuna
cargo build-sbf               # produces target/deploy/vuna.so (~204 KB)
```

## Deploy / upgrade on devnet

```bash
cd programs/vuna
solana program deploy target/deploy/vuna.so --url devnet \
  --program-id target/deploy/vuna-keypair.json
```

Initial deploy cost ~1.43 SOL on devnet (rent for the program data account).

## Toolchain

| Tool | Version |
|-|-|
| Rust (MSVC) | 1.95 |
| Solana CLI (Agave) | 3.1.14 |
| Anchor CLI | 1.0.2 |
| avm | 1.0.2 |

Windows requires Developer Mode enabled (for symlink creation during the build).

## Where to read first

- [`CLAUDE.md`](CLAUDE.md) — full design rules and integration map
- [`vuna/programs/vuna/src/lib.rs`](vuna/programs/vuna/src/lib.rs) — entrypoint with all 6 instruction signatures
- [`vuna/programs/vuna/src/state.rs`](vuna/programs/vuna/src/state.rs) — `FarmerAccount`, `GrowPack`, all the pure logic (`apply_event`, `quote`, `evaluate_payout`, `settle_at_harvest`) + their tests
- [`vuna/programs/vuna/tests/lifecycle.rs`](vuna/programs/vuna/tests/lifecycle.rs) — 3 end-to-end scenarios via litesvm
