// Multi-farmer devnet demo seed.
//
// Creates 5 demo farmers, each at a DIFFERENT point in the lifecycle, so
// the /coop page is populated with realistic queues:
//
//   1. Naledi  · Eastern Cape  → Requested  (sits in "Pending applications")
//   2. Thabo   · Limpopo       → Approved   (sits in "Awaiting disbursement")
//   3. Nomvula · KwaZulu-Natal → Active     (sits in "Drought watch")
//   4. Bongani · Free State    → InsurancePaid (drought fired, in "Harvest close")
//   5. Lerato  · North West    → Repaid    (closed pack)
//
// Idempotent in the same way as setup-devnet-demo.mjs — if a pack already
// exists for the current SEASON_ID, that farmer is skipped. To re-seed
// fresh state, bump SEASON_ID below.
//
// Uses your default Solana CLI keypair (~/.config/solana/id.json) as the
// cooperative (= signer for all instructions).
//
// Run from `app/`:
//   node scripts/setup-multi-demo.mjs

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
  settle_repayment:         new Uint8Array([129, 198, 176, 67, 69, 207, 220, 178]),
};

const SEASON_ID = 2026;
const SEED_COST = 420n;
const FERTILIZER_COST = 1150n;
const INSURANCE_COST = 85n;
const SERVICE_FEE_BPS = 1000;
const THRESHOLD_PERCENT = 80;
const MAX_PAYOUT = 1750n;

// total_repayment = (420 + 1150 + 85) * 1.10 = 1655 * 1.10 = 1820 (floor)
const TOTAL_REPAYMENT = 1820n;

// The 5 demo farmers. Each `idSeed` is hashed into the farmer_id_hash so
// re-runs produce the same farmer PDAs.
const FARMERS = [
  { name: "Naledi",  region: 0, idSeed: "demo:naledi",  stage: "requested" },
  { name: "Thabo",   region: 2, idSeed: "demo:thabo",   stage: "approved" },
  { name: "Nomvula", region: 1, idSeed: "demo:nomvula", stage: "active" },
  { name: "Bongani", region: 4, idSeed: "demo:bongani", stage: "insurance_paid" },
  { name: "Lerato",  region: 5, idSeed: "demo:lerato",  stage: "repaid" },
];

const REGION_NAMES = [
  "Eastern Cape",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Free State",
  "North West",
  "Western Cape",
  "Northern Cape",
  "Gauteng",
];

// ─── helpers ──────────────────────────────────────────────────────────────
function loadKeypair() {
  const p = path.join(homedir(), ".config", "solana", "id.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf-8"))));
}

function farmerIdHash(seed) {
  return createHash("sha256").update(seed).digest();
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

function ixRequestGrowPack(coop, hash) {
  const [farmer] = farmerPda(coop, hash);
  const [pack] = packPda(farmer, SEASON_ID);
  const data = new Uint8Array(47);
  const dv = new DataView(data.buffer);
  data.set(DISC.request_grow_pack, 0);
  let o = 8;
  dv.setUint32(o, SEASON_ID, true); o += 4;
  dv.setBigUint64(o, SEED_COST, true); o += 8;
  dv.setBigUint64(o, FERTILIZER_COST, true); o += 8;
  dv.setBigUint64(o, INSURANCE_COST, true); o += 8;
  dv.setUint16(o, SERVICE_FEE_BPS, true); o += 2;
  dv.setUint8(o, THRESHOLD_PERCENT); o += 1;
  dv.setBigUint64(o, MAX_PAYOUT, true);
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

function ixNoArgs(disc, coop, farmer, pack, farmerWritable = false) {
  const data = new Uint8Array(8);
  data.set(disc, 0);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pack, isSigner: false, isWritable: true },
      { pubkey: farmer, isSigner: false, isWritable: farmerWritable },
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

function ixSettleRepayment(coop, farmer, pack, saleProceeds) {
  const data = new Uint8Array(16);
  const dv = new DataView(data.buffer);
  data.set(DISC.settle_repayment, 0);
  dv.setBigUint64(8, saleProceeds, true);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pack, isSigner: false, isWritable: true },
      // settle_repayment mutates farmer credit score → farmer is writable
      { pubkey: farmer, isSigner: false, isWritable: true },
      { pubkey: coop, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

// ─── per-farmer lifecycle ─────────────────────────────────────────────────
async function send(conn, wallet, ixs, label) {
  const tx = new Transaction();
  for (const ix of ixs) tx.add(ix);
  process.stdout.write(`    ${label}…`);
  const sig = await sendAndConfirmTransaction(conn, tx, [wallet], {
    commitment: "confirmed",
  });
  process.stdout.write(`  ✅\n`);
  return sig;
}

async function seedFarmer(conn, wallet, farmer) {
  const hash = farmerIdHash(farmer.idSeed);
  const [farmerAcc] = farmerPda(wallet.publicKey, hash);
  const [packAcc] = packPda(farmerAcc, SEASON_ID);
  console.log(`  ${farmer.name}  (${REGION_NAMES[farmer.region]})`);
  console.log(`    farmer: ${farmerAcc.toBase58()}`);
  console.log(`    pack:   ${packAcc.toBase58()}`);

  const existingPack = await conn.getAccountInfo(packAcc);
  if (existingPack) {
    console.log(`    pack exists — skipping (bump SEASON_ID to re-seed)\n`);
    return;
  }

  // 1. register (unless farmer already exists from a prior season)
  const existingFarmer = await conn.getAccountInfo(farmerAcc);
  if (!existingFarmer) {
    await send(
      conn, wallet,
      [ixRegisterFarmer(wallet.publicKey, hash, farmer.region)],
      "register_farmer",
    );
  }

  // 2. request — every farmer at least reaches this stage
  await send(
    conn, wallet,
    [ixRequestGrowPack(wallet.publicKey, hash)],
    "request_grow_pack",
  );

  if (farmer.stage === "requested") {
    console.log(`    → final stage: Requested\n`);
    return;
  }

  // 3. approve
  await send(
    conn, wallet,
    [ixNoArgs(DISC.approve_grow_pack, wallet.publicKey, farmerAcc, packAcc)],
    "approve_grow_pack",
  );

  if (farmer.stage === "approved") {
    console.log(`    → final stage: Approved\n`);
    return;
  }

  // 4. disburse
  await send(
    conn, wallet,
    [ixNoArgs(DISC.disburse_grow_pack, wallet.publicKey, farmerAcc, packAcc)],
    "disburse_grow_pack",
  );

  if (farmer.stage === "active") {
    console.log(`    → final stage: Active\n`);
    return;
  }

  // 5. trigger drought payout (rainfall 40% = tier 3 = R 1 400)
  await send(
    conn, wallet,
    [ixTriggerInsurance(wallet.publicKey, farmerAcc, packAcc, 40)],
    "trigger_insurance_payout (40% rainfall)",
  );

  if (farmer.stage === "insurance_paid") {
    console.log(`    → final stage: InsurancePaid\n`);
    return;
  }

  // 6. settle at harvest — sale proceeds == total_repayment for a clean close
  await send(
    conn, wallet,
    [ixSettleRepayment(wallet.publicKey, farmerAcc, packAcc, TOTAL_REPAYMENT)],
    `settle_repayment (sale=R${TOTAL_REPAYMENT})`,
  );

  console.log(`    → final stage: Repaid\n`);
}

// ─── main ────────────────────────────────────────────────────────────────
async function main() {
  const wallet = loadKeypair();
  const conn = new Connection(RPC_URL, "confirmed");
  const balance = await conn.getBalance(wallet.publicKey);

  console.log("");
  console.log(`Cooperative: ${wallet.publicKey.toBase58()}`);
  console.log(`Balance:     ${(balance / 1e9).toFixed(4)} SOL on ${RPC_URL}`);
  console.log(`Season:      ${SEASON_ID}`);
  console.log("");

  for (const farmer of FARMERS) {
    try {
      await seedFarmer(conn, wallet, farmer);
    } catch (err) {
      console.error(`    ❌ ${farmer.name} failed:`, err.message || err);
    }
  }

  console.log("🎉 Multi-farmer seed complete.");
  console.log("");
  console.log("Open the dashboard:");
  console.log("  http://localhost:3000/coop      (all 5 farmers visible across queues)");
  console.log("  http://localhost:3000/dashboard (connect cooperative wallet to see one)");
}

main().catch((err) => {
  console.error("");
  console.error("❌ multi-seed failed:", err);
  process.exit(1);
});
