//! Lifecycle integration tests for the Vuna program.
//!
//! These tests load the compiled `vuna.so` into an in-process `litesvm`
//! runtime and exercise the actual on-chain program — no external
//! `solana-test-validator`, no devnet.
//!
//! Mirrors `tests/integration/grow-pack-flow.test.ts`, but instead of
//! testing the TypeScript spec these tests prove the Rust port behaves
//! the same way through the full instruction surface.
//!
//! Prerequisite: `cargo build-sbf` has been run so `target/deploy/vuna.so`
//! exists. Run with: `cargo test --test lifecycle`.

use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::{instruction::Instruction, system_program};
use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;

use vuna::{
    constants::{FARMER_SEED, GROW_PACK_SEED, SCORE_INITIAL},
    state::{FarmerAccount, GrowPack, GrowPackStatus},
};

// ============================================================================
//  Constants — match the canonical proposal numbers from
//  tests/helpers/fixtures.ts.
// ============================================================================

const PROGRAM_SO_PATH: &str =
    concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/vuna.so");

const SEED_COST: u64 = 420;
const FERTILIZER_COST: u64 = 1150;
const INSURANCE_COST: u64 = 85;
const SERVICE_FEE_BPS: u16 = 1000;
const THRESHOLD_PERCENT: u8 = 80;
const MAX_PAYOUT: u64 = 1750;
const SEASON_ID: u32 = 2026;
const FARMER_ID_HASH: [u8; 32] = [42u8; 32];
const REGION_EASTERN_CAPE: u8 = 0;

// ============================================================================
//  Setup
// ============================================================================

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(vuna::ID, PROGRAM_SO_PATH)
        .expect("loading vuna.so — did you run `cargo build-sbf`?");
    let cooperative = Keypair::new();
    svm.airdrop(&cooperative.pubkey(), 10_000_000_000).unwrap();
    (svm, cooperative)
}

fn send_ix(svm: &mut LiteSVM, ix: Instruction, signers: &[&Keypair]) {
    let payer_pubkey = signers[0].pubkey();
    let blockhash = svm.latest_blockhash();
    let tx = Transaction::new_signed_with_payer(&[ix], Some(&payer_pubkey), signers, blockhash);
    svm.send_transaction(tx).unwrap();
}

// ============================================================================
//  Account fetchers
// ============================================================================

fn fetch_farmer(svm: &LiteSVM, farmer: Pubkey) -> FarmerAccount {
    let acc = svm.get_account(&farmer).expect("farmer account should exist");
    FarmerAccount::try_deserialize(&mut acc.data.as_slice()).unwrap()
}

fn fetch_pack(svm: &LiteSVM, pack: Pubkey) -> GrowPack {
    let acc = svm.get_account(&pack).expect("pack account should exist");
    GrowPack::try_deserialize(&mut acc.data.as_slice()).unwrap()
}

// ============================================================================
//  PDA derivation
// ============================================================================

fn farmer_pda(cooperative: Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[FARMER_SEED, cooperative.as_ref(), &FARMER_ID_HASH],
        &vuna::ID,
    )
    .0
}

fn pack_pda(farmer: Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[GROW_PACK_SEED, farmer.as_ref(), &SEASON_ID.to_le_bytes()],
        &vuna::ID,
    )
    .0
}

// ============================================================================
//  Instruction wrappers — one per program instruction
// ============================================================================

fn register_farmer(svm: &mut LiteSVM, cooperative: &Keypair) -> Pubkey {
    let farmer = farmer_pda(cooperative.pubkey());
    let ix = Instruction {
        program_id: vuna::ID,
        accounts: vuna::accounts::RegisterFarmer {
            farmer,
            cooperative: cooperative.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: vuna::instruction::RegisterFarmer {
            farmer_id_hash: FARMER_ID_HASH,
            region: REGION_EASTERN_CAPE,
        }
        .data(),
    };
    send_ix(svm, ix, &[cooperative]);
    farmer
}

fn request_grow_pack(svm: &mut LiteSVM, cooperative: &Keypair, farmer: Pubkey) -> Pubkey {
    let pack = pack_pda(farmer);
    let ix = Instruction {
        program_id: vuna::ID,
        accounts: vuna::accounts::RequestGrowPack {
            pack,
            farmer,
            cooperative: cooperative.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: vuna::instruction::RequestGrowPack {
            season_id: SEASON_ID,
            seed_cost: SEED_COST,
            fertilizer_cost: FERTILIZER_COST,
            insurance_cost: INSURANCE_COST,
            service_fee_bps: SERVICE_FEE_BPS,
            threshold_percent: THRESHOLD_PERCENT,
            max_payout: MAX_PAYOUT,
        }
        .data(),
    };
    send_ix(svm, ix, &[cooperative]);
    pack
}

fn approve_grow_pack(svm: &mut LiteSVM, cooperative: &Keypair, farmer: Pubkey, pack: Pubkey) {
    let ix = Instruction {
        program_id: vuna::ID,
        accounts: vuna::accounts::ApproveGrowPack {
            pack,
            farmer,
            cooperative: cooperative.pubkey(),
        }
        .to_account_metas(None),
        data: vuna::instruction::ApproveGrowPack {}.data(),
    };
    send_ix(svm, ix, &[cooperative]);
}

fn disburse_grow_pack(svm: &mut LiteSVM, cooperative: &Keypair, farmer: Pubkey, pack: Pubkey) {
    let ix = Instruction {
        program_id: vuna::ID,
        accounts: vuna::accounts::DisburseGrowPack {
            pack,
            farmer,
            cooperative: cooperative.pubkey(),
        }
        .to_account_metas(None),
        data: vuna::instruction::DisburseGrowPack {}.data(),
    };
    send_ix(svm, ix, &[cooperative]);
}

fn trigger_insurance_payout(
    svm: &mut LiteSVM,
    cooperative: &Keypair,
    farmer: Pubkey,
    pack: Pubkey,
    rainfall_percent_of_norm: u8,
) {
    let ix = Instruction {
        program_id: vuna::ID,
        accounts: vuna::accounts::TriggerInsurancePayout {
            pack,
            farmer,
            cooperative: cooperative.pubkey(),
        }
        .to_account_metas(None),
        data: vuna::instruction::TriggerInsurancePayout {
            rainfall_percent_of_norm,
        }
        .data(),
    };
    send_ix(svm, ix, &[cooperative]);
}

fn settle_repayment(
    svm: &mut LiteSVM,
    cooperative: &Keypair,
    farmer: Pubkey,
    pack: Pubkey,
    sale_proceeds: u64,
) {
    let ix = Instruction {
        program_id: vuna::ID,
        accounts: vuna::accounts::SettleRepayment {
            pack,
            farmer,
            cooperative: cooperative.pubkey(),
        }
        .to_account_metas(None),
        data: vuna::instruction::SettleRepayment { sale_proceeds }.data(),
    };
    send_ix(svm, ix, &[cooperative]);
}

// ============================================================================
//  Tests — three lifecycle scenarios
// ============================================================================

/// Nomsa registers, gets a Grow Pack, harvests well, repays in full.
/// Score goes from 600 to 620.
#[test]
fn happy_path_lifecycle() {
    let (mut svm, coop) = setup();

    let farmer = register_farmer(&mut svm, &coop);
    let f = fetch_farmer(&svm, farmer);
    assert_eq!(f.score, SCORE_INITIAL);
    assert_eq!(f.region, REGION_EASTERN_CAPE);
    assert_eq!(f.total_packs, 0);

    let pack = request_grow_pack(&mut svm, &coop, farmer);
    let p = fetch_pack(&svm, pack);
    assert_eq!(p.status, GrowPackStatus::Requested);
    assert_eq!(p.bundle_cost, 1_655);
    assert_eq!(p.service_fee, 165);
    assert_eq!(p.total_repayment, 1_820);

    approve_grow_pack(&mut svm, &coop, farmer, pack);
    assert_eq!(fetch_pack(&svm, pack).status, GrowPackStatus::Approved);

    disburse_grow_pack(&mut svm, &coop, farmer, pack);
    assert_eq!(fetch_pack(&svm, pack).status, GrowPackStatus::Active);

    // Good harvest — sale exceeds the loan, surplus to farmer.
    settle_repayment(&mut svm, &coop, farmer, pack, 2_500);

    let p = fetch_pack(&svm, pack);
    assert_eq!(p.status, GrowPackStatus::Repaid);
    assert_eq!(p.repaid, 1_820);
    assert_eq!(p.surplus, 680);
    assert_eq!(p.defaulted, 0);

    let f = fetch_farmer(&svm, farmer);
    assert_eq!(f.score, 620);
    assert_eq!(f.total_packs, 1);
    assert_eq!(f.successful_repayments, 1);
    assert_eq!(f.defaults, 0);
    assert_eq!(f.insurance_triggers, 0);
}

/// Sipho's rainfall hits 40% of norm — tier3 drought.
/// Insurance pays out R 1 400. Even with no harvest sale, the insurance-first
/// rule preserves Sipho's score (drought wasn't his fault).
#[test]
fn drought_payout_lifecycle() {
    let (mut svm, coop) = setup();

    let farmer = register_farmer(&mut svm, &coop);
    let pack = request_grow_pack(&mut svm, &coop, farmer);
    approve_grow_pack(&mut svm, &coop, farmer, pack);
    disburse_grow_pack(&mut svm, &coop, farmer, pack);

    // Drought hits at 40% of norm — tier3, R 1 400 payout.
    trigger_insurance_payout(&mut svm, &coop, farmer, pack, 40);

    let p = fetch_pack(&svm, pack);
    assert_eq!(p.status, GrowPackStatus::InsurancePaid);
    assert_eq!(p.rainfall_percent_of_norm, 40);
    assert_eq!(p.insurance_payout, 1_400);

    // No harvest. Insurance covers R 1 400 of R 1 820 due. Defaulted by R 420.
    settle_repayment(&mut svm, &coop, farmer, pack, 0);

    let p = fetch_pack(&svm, pack);
    assert_eq!(p.repaid, 1_400);
    assert_eq!(p.surplus, 0);
    assert_eq!(p.defaulted, 420);
    assert_eq!(p.status, GrowPackStatus::Defaulted);

    // Insurance-first rule: drought year never damages the score.
    let f = fetch_farmer(&svm, farmer);
    assert_eq!(f.score, SCORE_INITIAL); // 600 — unchanged
    assert_eq!(f.insurance_triggers, 1);
    assert_eq!(f.defaults, 0);
    assert_eq!(f.successful_repayments, 0);
    assert_eq!(f.total_packs, 1);
}

/// Lebo's rainfall is normal but the harvest still failed — only R 200 in
/// sale proceeds. No insurance fires. The pack defaults; score drops 100.
#[test]
fn default_lifecycle_no_drought_failed_harvest() {
    let (mut svm, coop) = setup();

    let farmer = register_farmer(&mut svm, &coop);
    let pack = request_grow_pack(&mut svm, &coop, farmer);
    approve_grow_pack(&mut svm, &coop, farmer, pack);
    disburse_grow_pack(&mut svm, &coop, farmer, pack);

    // No drought trigger. Only R 200 in sale proceeds.
    settle_repayment(&mut svm, &coop, farmer, pack, 200);

    let p = fetch_pack(&svm, pack);
    assert_eq!(p.status, GrowPackStatus::Defaulted);
    assert_eq!(p.repaid, 200);
    assert_eq!(p.surplus, 0);
    assert_eq!(p.defaulted, 1_620);
    assert_eq!(p.insurance_payout, 0);

    // Default → score -100.
    let f = fetch_farmer(&svm, farmer);
    assert_eq!(f.score, 500);
    assert_eq!(f.defaults, 1);
    assert_eq!(f.successful_repayments, 0);
    assert_eq!(f.insurance_triggers, 0);
    assert_eq!(f.total_packs, 1);
}
