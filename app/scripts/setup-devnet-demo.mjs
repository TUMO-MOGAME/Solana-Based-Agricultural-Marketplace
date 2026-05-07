// One-shot devnet setup script for Mazra'at albaan.
//
// Walks the full Grow Pack lifecycle for a single demo farmer:
//   register_farmer → request_grow_pack → approve → disburse →
//   trigger_insurance_payout (rainfall 40% = tier3 → R 1 400 payout)
//
// At the end it prints the GrowPack PDA — open `/insurance/<that>` in the
// Mazra'at albaan frontend (locally or on Vercel) to see real on-chain data.
//
// Run from `app/`:
//   node scripts/setup-devnet-demo.mjs
//
// Uses your default Solana CLI keypair (~/.config/solana/id.json) as the
// signer. That keypair plays the role of "cooperative" for demo purposes.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

// ─── constants ────────────────────────────────────────────────────────────
const PROGRAM_ID = new PublicKey("7LUkUHVazSw732334JKFP88VAFc4iYXXJZkgFnZV9kqA");
const RPC_URL = process.env.SOLANA_RPC || "https://api.devnet.solana.com";

const FARMER_SEED = Buffer.from("farmer");
const GROW_PACK_SEED = Buffer.from("pack");

const DISC = {
  register_farmer:          new Uint8Array([63, 234, 139, 94, 48, 7, 57, 201]),
  request_grow_pack:        new Uint8Array([87, 250, 138, 80, 99, 29, 254, 240]),
  approve_grow_pack:        new Uint8Array([162, 148, 198, 224, 8, 87, 231, 59]),
  disburse_grow_pack:       new Uint8Array([102, 96, 218, 179, 117, 153, 65, 190]),
  trigger_insurance_payout: new Uint8Array([6, 141, 36, 41, 176, 33, 10, 82]),
};

// Demo Grow Pack — proposal-canonical numbers
const SEASON_ID = 2026;
const REGION = 0; // Eastern Cape
const SEED_COST = 420n;
const FERTILIZER_COST = 1150n;
const INSURANCE_COST = 85n;
const SERVICE_FEE_BPS = 1000;
const THRESHOLD_PERCENT = 80;
const MAX_PAYOUT = 1750n;
const RAINFALL_PERCENT = 40; // tier3 — pays out 80% of cover = R 1 400

// ─── helpers ──────────────────────────────────────────────────────────────
function loadKeypair() {
  const p = path.join(homedir(), ".config", "solana", "id.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf-8"))));
}

function farmerPda(coop, hash) {
  return PublicKey.findProgramAddressSync(
    [FARMER_SEED, coop.toBuffer(), Buffer.from(hash)],
    PROGRAM_ID,
  );
}

function packPda(farmer, seasonId) {
  const seasonBuf = Buffer.alloc(4);
  seasonBuf.writeUInt32LE(seasonId, 0);
  return PublicKey.findProgramAddressSync(
    [GROW_PACK_SEED, farmer.toBuffer(), seasonBuf],
    PROGRAM_ID,
  );
}

// ─── instruction encoders ─────────────────────────────────────────────────
function ixRegisterFarmer(coop, hash, region) {
  const [farmer] = farmerPda(coop, hash);
  const data = new Uint8Array(41);
  data.set(DISC.register_farmer, 0);
  data.set(hash, 8);
  data[40] = region;
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: farmer, isSigner: false, isWritable: true },
      { pubkey: coop, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

function ixRequestGrowPack(coop, hash, args) {
  const [farmer] = farmerPda(coop, hash);
  const [pack] = packPda(farmer, args.seasonId);
  const data = new Uint8Array(47);
  const dv = new DataView(data.buffer);
  data.set(DISC.request_grow_pack, 0);
  let o = 8;
  dv.setUint32(o, args.seasonId, true); o += 4;
  dv.setBigUint64(o, args.seedCost, true); o += 8;
  dv.setBigUint64(o, args.fertilizerCost, true); o += 8;
  dv.setBigUint64(o, args.insuranceCost, true); o += 8;
  dv.setUint16(o, args.serviceFeeBps, true); o += 2;
  dv.setUint8(o, args.thresholdPercent); o += 1;
  dv.setBigUint64(o, args.maxPayout, true);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pack, isSigner: false, isWritable: true },
      { pubkey: farmer, isSigner: false, isWritable: false },
      { pubkey: coop, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

function ixNoArgs(disc, coop, farmer, pack) {
  const data = new Uint8Array(8);
  data.set(disc, 0);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pack, isSigner: false, isWritable: true },
      { pubkey: farmer, isSigner: false, isWritable: false },
      { pubkey: coop, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

function ixTriggerInsurance(coop, farmer, pack, rainfallPercent) {
  const data = new Uint8Array(9);
  data.set(DISC.trigger_insurance_payout, 0);
  data[8] = rainfallPercent;
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pack, isSigner: false, isWritable: true },
      { pubkey: farmer, isSigner: false, isWritable: false },
      { pubkey: coop, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

// ─── main ────────────────────────────────────────────────────────────────
async function send(conn, wallet, ixs, label) {
  const tx = new Transaction();
  for (const ix of ixs) tx.add(ix);
  process.stdout.write(`  ${label}…`);
  const sig = await sendAndConfirmTransaction(conn, tx, [wallet], {
    commitment: "confirmed",
  });
  console.log(`  ✅  ${sig}`);
  return sig;
}

async function main() {
  const wallet = loadKeypair();
  console.log(`Wallet:    ${wallet.publicKey.toBase58()}`);

  const conn = new Connection(RPC_URL, "confirmed");
  const balance = await conn.getBalance(wallet.publicKey);
  console.log(`Balance:   ${(balance / 1e9).toFixed(4)} SOL on ${RPC_URL}`);

  const farmerIdHash = createHash("sha256")
    .update(wallet.publicKey.toBase58().toLowerCase())
    .digest();
  const [farmerAcc] = farmerPda(wallet.publicKey, farmerIdHash);
  const [packAcc] = packPda(farmerAcc, SEASON_ID);
  console.log(`Farmer:    ${farmerAcc.toBase58()}`);
  console.log(`Pack:      ${packAcc.toBase58()}`);
  console.log("");

  // 1. register_farmer (skip if already exists)
  const existingFarmer = await conn.getAccountInfo(farmerAcc);
  if (existingFarmer) {
    console.log("Farmer already registered, skipping.");
  } else {
    await send(
      conn, wallet,
      [ixRegisterFarmer(wallet.publicKey, farmerIdHash, REGION)],
      "register_farmer",
    );
  }

  // 2. request_grow_pack (skip if pack already exists)
  const existingPack = await conn.getAccountInfo(packAcc);
  if (existingPack) {
    console.log(`Pack for season ${SEASON_ID} already exists.`);
    console.log(`To re-run, change SEASON_ID in setup-devnet-demo.mjs.`);
    console.log("");
    console.log(`🎉 Open: /insurance/${packAcc.toBase58()}`);
    return;
  }

  await send(
    conn, wallet,
    [ixRequestGrowPack(wallet.publicKey, farmerIdHash, {
      seasonId: SEASON_ID,
      seedCost: SEED_COST,
      fertilizerCost: FERTILIZER_COST,
      insuranceCost: INSURANCE_COST,
      serviceFeeBps: SERVICE_FEE_BPS,
      thresholdPercent: THRESHOLD_PERCENT,
      maxPayout: MAX_PAYOUT,
    })],
    "request_grow_pack",
  );

  // 3. approve_grow_pack
  await send(
    conn, wallet,
    [ixNoArgs(DISC.approve_grow_pack, wallet.publicKey, farmerAcc, packAcc)],
    "approve_grow_pack",
  );

  // 4. disburse_grow_pack
  await send(
    conn, wallet,
    [ixNoArgs(DISC.disburse_grow_pack, wallet.publicKey, farmerAcc, packAcc)],
    "disburse_grow_pack",
  );

  // 5. trigger_insurance_payout — rainfall 40% = tier3 (80% of R 1 750 = R 1 400)
  await send(
    conn, wallet,
    [ixTriggerInsurance(wallet.publicKey, farmerAcc, packAcc, RAINFALL_PERCENT)],
    `trigger_insurance_payout (rainfall=${RAINFALL_PERCENT}%)`,
  );

  console.log("");
  console.log("🎉 Demo Grow Pack created with drought-payout fired.");
  console.log("");
  console.log(`Pack: ${packAcc.toBase58()}`);
  console.log(`Open: http://localhost:3000/insurance/${packAcc.toBase58()}`);
}

main().catch((err) => {
  console.error("");
  console.error("❌ setup failed:", err);
  process.exit(1);
});
