// Mazra'at albaan — Solana program client (read-only).
//
// Hand-rolled Borsh decoders for the on-chain accounts we need to read,
// plus helpers to derive the PDAs the Rust program uses.
// Mirrors `programs/vuna/programs/vuna/src/state.rs` exactly. If the Rust
// struct changes, update this file in the same commit.
//
// We use a manual decoder (instead of @coral-xyz/anchor's BorshAccountsCoder
// + IDL JSON) because anchor's IDL builder currently fails on Windows; this
// keeps us moving without depending on the broken toolchain path.

import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

// Program ID — must match `declare_id!` in programs/vuna/programs/vuna/src/lib.rs
export const PROGRAM_ID = new PublicKey(
  "7LUkUHVazSw732334JKFP88VAFc4iYXXJZkgFnZV9kqA",
);

// PDA seed prefixes — must match constants.rs
const FARMER_SEED = Buffer.from("farmer");
const GROW_PACK_SEED = Buffer.from("pack");
const DEAL_SEED = Buffer.from("deal");

// ============================================================================
//  Connection
// ============================================================================

/** Default Solana RPC endpoint. Override with `NEXT_PUBLIC_SOLANA_RPC`. */
export function getConnection(): Connection {
  const url =
    process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
  return new Connection(url, "confirmed");
}

// ============================================================================
//  PDA derivation
// ============================================================================

/** Derive the FarmerAccount PDA for (cooperative, farmer_id_hash). */
export function farmerPda(
  cooperative: PublicKey,
  farmerIdHash: Uint8Array,
): [PublicKey, number] {
  if (farmerIdHash.length !== 32) {
    throw new Error("farmer_id_hash must be 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [FARMER_SEED, cooperative.toBuffer(), Buffer.from(farmerIdHash)],
    PROGRAM_ID,
  );
}

/** Derive the GrowPack PDA for (farmer, season_id). */
export function packPda(
  farmer: PublicKey,
  seasonId: number,
): [PublicKey, number] {
  const seasonBuf = Buffer.alloc(4);
  seasonBuf.writeUInt32LE(seasonId, 0);
  return PublicKey.findProgramAddressSync(
    [GROW_PACK_SEED, farmer.toBuffer(), seasonBuf],
    PROGRAM_ID,
  );
}

/**
 * Derive the Deal PDA for (buyer, farmer, deal_id). Marketplace escrow.
 * Mirrors the seed list in `programs/vuna/programs/vuna/src/instructions/create_deal.rs`.
 */
export function dealPda(
  buyer: PublicKey,
  farmer: PublicKey,
  dealId: bigint,
): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(dealId, 0);
  return PublicKey.findProgramAddressSync(
    [DEAL_SEED, buyer.toBuffer(), farmer.toBuffer(), idBuf],
    PROGRAM_ID,
  );
}

// ============================================================================
//  Account types — TypeScript shape mirrors the Rust struct in state.rs
// ============================================================================

export type GrowPackStatus =
  | "Requested"
  | "Approved"
  | "Active"
  | "InsurancePaid"
  | "Repaid"
  | "Defaulted";

const GROW_PACK_STATUS_BY_TAG: Record<number, GrowPackStatus> = {
  0: "Requested",
  1: "Approved",
  2: "Active",
  3: "InsurancePaid",
  4: "Repaid",
  5: "Defaulted",
};

export interface GrowPack {
  farmer: PublicKey;
  seasonId: number;
  status: GrowPackStatus;
  seedCost: bigint;
  fertilizerCost: bigint;
  insuranceCost: bigint;
  serviceFeeBps: number;
  bundleCost: bigint;
  serviceFee: bigint;
  totalRepayment: bigint;
  thresholdPercent: number;
  maxPayout: bigint;
  rainfallPercentOfNorm: number;
  insurancePayout: bigint;
  saleProceeds: bigint;
  repaid: bigint;
  surplus: bigint;
  defaulted: bigint;
  bump: number;
}

export interface FarmerAccount {
  cooperative: PublicKey;
  farmerIdHash: Uint8Array;
  region: number;
  score: number;
  totalPacks: number;
  successfulRepayments: number;
  defaults: number;
  insuranceTriggers: number;
  bump: number;
}

// ============================================================================
//  Borsh decoders — hand-rolled, match state.rs byte layout
// ============================================================================

/**
 * Tiny cursor over a Uint8Array. Reads little-endian numbers and bytes.
 * Throws if the read goes past the end — that means our schema is wrong.
 */
class Cursor {
  private dv: DataView;
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  skip(n: number): void {
    this.offset += n;
  }

  u8(): number {
    const v = this.dv.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  u16(): number {
    const v = this.dv.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }

  u32(): number {
    const v = this.dv.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  u64(): bigint {
    const v = this.dv.getBigUint64(this.offset, true);
    this.offset += 8;
    return v;
  }

  fixedBytes(n: number): Uint8Array {
    const out = this.bytes.slice(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }

  pubkey(): PublicKey {
    return new PublicKey(this.fixedBytes(32));
  }
}

/** Skip the 8-byte Anchor account discriminator. We don't validate it here —
 *  the caller is presumed to have asked for the right account type. */
const DISCRIMINATOR_LEN = 8;

export function decodeGrowPack(data: Uint8Array): GrowPack {
  const c = new Cursor(data);
  c.skip(DISCRIMINATOR_LEN);

  const farmer = c.pubkey();
  const seasonId = c.u32();
  const statusTag = c.u8();
  const status = GROW_PACK_STATUS_BY_TAG[statusTag];
  if (!status) throw new Error(`Unknown GrowPackStatus tag: ${statusTag}`);

  const seedCost = c.u64();
  const fertilizerCost = c.u64();
  const insuranceCost = c.u64();
  const serviceFeeBps = c.u16();
  const bundleCost = c.u64();
  const serviceFee = c.u64();
  const totalRepayment = c.u64();

  const thresholdPercent = c.u8();
  const maxPayout = c.u64();

  const rainfallPercentOfNorm = c.u8();
  const insurancePayout = c.u64();

  const saleProceeds = c.u64();
  const repaid = c.u64();
  const surplus = c.u64();
  const defaulted = c.u64();

  const bump = c.u8();

  return {
    farmer,
    seasonId,
    status,
    seedCost,
    fertilizerCost,
    insuranceCost,
    serviceFeeBps,
    bundleCost,
    serviceFee,
    totalRepayment,
    thresholdPercent,
    maxPayout,
    rainfallPercentOfNorm,
    insurancePayout,
    saleProceeds,
    repaid,
    surplus,
    defaulted,
    bump,
  };
}

export function decodeFarmerAccount(data: Uint8Array): FarmerAccount {
  const c = new Cursor(data);
  c.skip(DISCRIMINATOR_LEN);

  const cooperative = c.pubkey();
  const farmerIdHash = c.fixedBytes(32);
  const region = c.u8();
  const score = c.u16();
  const totalPacks = c.u32();
  const successfulRepayments = c.u32();
  const defaults = c.u32();
  const insuranceTriggers = c.u32();
  const bump = c.u8();

  return {
    cooperative,
    farmerIdHash,
    region,
    score,
    totalPacks,
    successfulRepayments,
    defaults,
    insuranceTriggers,
    bump,
  };
}

// ============================================================================
//  Account fetchers
// ============================================================================

/** Fetch and decode a GrowPack, or null if the account doesn't exist. */
export async function fetchGrowPack(
  connection: Connection,
  pack: PublicKey,
): Promise<GrowPack | null> {
  const info = await connection.getAccountInfo(pack);
  if (!info) return null;
  return decodeGrowPack(info.data);
}

/** Fetch and decode a FarmerAccount, or null if the account doesn't exist. */
export async function fetchFarmerAccount(
  connection: Connection,
  farmer: PublicKey,
): Promise<FarmerAccount | null> {
  const info = await connection.getAccountInfo(farmer);
  if (!info) return null;
  return decodeFarmerAccount(info.data);
}

// ============================================================================
//  Instruction encoders + transaction builders (write path)
//
//  Anchor instructions = 8-byte sha256("global:<name>")[0..8] discriminator
//  + Borsh-encoded args. We compute discriminators offline and hardcode them
//  rather than depend on Anchor's IDL build (which is currently broken on
//  Windows). Mirrors `programs/vuna/programs/vuna/src/lib.rs` instruction
//  signatures one-for-one.
// ============================================================================

const DISCRIMINATORS = {
  register_farmer: new Uint8Array([63, 234, 139, 94, 48, 7, 57, 201]),
  request_grow_pack: new Uint8Array([87, 250, 138, 80, 99, 29, 254, 240]),
  approve_grow_pack: new Uint8Array([162, 148, 198, 224, 8, 87, 231, 59]),
  disburse_grow_pack: new Uint8Array([102, 96, 218, 179, 117, 153, 65, 190]),
  trigger_insurance_payout: new Uint8Array([6, 141, 36, 41, 176, 33, 10, 82]),
  settle_repayment: new Uint8Array([129, 198, 176, 67, 69, 207, 220, 178]),
  // Marketplace (Phase 2)
  create_deal: new Uint8Array([198, 212, 144, 151, 97, 56, 149, 113]),
  confirm_and_release: new Uint8Array([136, 35, 54, 211, 241, 17, 40, 188]),
} as const;

/** Anchor account-discriminator for the Deal account type. */
const DEAL_ACCOUNT_DISC = new Uint8Array([125, 223, 160, 234, 71, 162, 182, 219]);

/** Default service-fee bps (10%) — matches `core/grow-pack.ts`. */
export const SERVICE_FEE_BPS_DEFAULT = 1000;

/** Quote a Grow Pack — mirrors `quoteGrowPack` in `core/grow-pack.ts`. */
export function quoteGrowPack(
  seedCost: number,
  fertilizerCost: number,
  insuranceCost: number,
  serviceFeeBps: number = SERVICE_FEE_BPS_DEFAULT,
): { bundleCost: number; serviceFee: number; totalRepayment: number } {
  const bundleCost = seedCost + fertilizerCost + insuranceCost;
  const serviceFee = Math.floor((bundleCost * serviceFeeBps) / 10_000);
  const totalRepayment = bundleCost + serviceFee;
  return { bundleCost, serviceFee, totalRepayment };
}

/**
 * Hash an arbitrary string into a 32-byte farmer ID hash.
 * In production, the cooperative would hash a structured PII record;
 * for the demo we hash the farmer's email or login identifier.
 */
export async function farmerIdHashFrom(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

// ---- register_farmer ---------------------------------------------------------

export interface RegisterFarmerArgs {
  cooperative: PublicKey;
  farmerIdHash: Uint8Array;
  region: number;
}

export function makeRegisterFarmerIx(args: RegisterFarmerArgs): TransactionInstruction {
  if (args.farmerIdHash.length !== 32) {
    throw new Error("farmerIdHash must be 32 bytes");
  }
  const [farmer] = farmerPda(args.cooperative, args.farmerIdHash);

  // disc(8) + farmer_id_hash(32) + region(1) = 41 bytes
  const data = new Uint8Array(41);
  data.set(DISCRIMINATORS.register_farmer, 0);
  data.set(args.farmerIdHash, 8);
  data[40] = args.region & 0xff;

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: farmer, isSigner: false, isWritable: true },
      { pubkey: args.cooperative, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

// ---- request_grow_pack ------------------------------------------------------

export interface RequestGrowPackArgs {
  cooperative: PublicKey;
  farmerIdHash: Uint8Array;
  seasonId: number;
  seedCost: bigint;
  fertilizerCost: bigint;
  insuranceCost: bigint;
  serviceFeeBps: number;
  thresholdPercent: number;
  maxPayout: bigint;
}

export function makeRequestGrowPackIx(
  args: RequestGrowPackArgs,
): TransactionInstruction {
  if (args.farmerIdHash.length !== 32) {
    throw new Error("farmerIdHash must be 32 bytes");
  }
  const [farmer] = farmerPda(args.cooperative, args.farmerIdHash);
  const [pack] = packPda(farmer, args.seasonId);

  // disc(8) + season(4) + 3×u64(24) + bps(2) + threshold(1) + maxPayout(8) = 47 bytes
  const data = new Uint8Array(47);
  const dv = new DataView(data.buffer);
  data.set(DISCRIMINATORS.request_grow_pack, 0);
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
      { pubkey: args.cooperative, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

// ============================================================================
//  Marketplace — Deal account + create_deal + confirm_and_release
//
//  Mirrors the Rust definition in
//  programs/vuna/programs/vuna/src/state.rs::Deal and the two instruction
//  modules at instructions/{create_deal,confirm_and_release}.rs
// ============================================================================

export interface Deal {
  buyer: PublicKey;
  farmer: PublicKey;
  dealId: bigint;
  amountLamports: bigint;
  createdAt: bigint;
  bump: number;
}

/** Borsh layout: 32 + 32 + 8 + 8 + 8 + 1 = 89 bytes (after the 8-byte disc). */
export function decodeDeal(data: Uint8Array): Deal {
  if (data.length < 8 + 89) {
    throw new Error(`Deal account too small: ${data.length} bytes`);
  }
  for (let i = 0; i < 8; i++) {
    if (data[i] !== DEAL_ACCOUNT_DISC[i]) {
      throw new Error("Deal: account-discriminator mismatch");
    }
  }
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8;
  const buyer = new PublicKey(data.slice(o, o + 32)); o += 32;
  const farmer = new PublicKey(data.slice(o, o + 32)); o += 32;
  const dealId = dv.getBigUint64(o, true); o += 8;
  const amountLamports = dv.getBigUint64(o, true); o += 8;
  const createdAt = dv.getBigInt64(o, true); o += 8;
  const bump = dv.getUint8(o);
  return { buyer, farmer, dealId, amountLamports, createdAt, bump };
}

export async function fetchDeal(
  connection: Connection,
  deal: PublicKey,
): Promise<Deal | null> {
  const info = await connection.getAccountInfo(deal);
  if (!info) return null;
  return decodeDeal(info.data);
}

// ---- create_deal ------------------------------------------------------------

export interface CreateDealArgs {
  buyer: PublicKey;
  farmer: PublicKey;
  dealId: bigint;
  amountLamports: bigint;
}

export function makeCreateDealIx(args: CreateDealArgs): TransactionInstruction {
  const [deal] = dealPda(args.buyer, args.farmer, args.dealId);

  // disc(8) + deal_id(u64=8) + amount_lamports(u64=8) = 24 bytes
  const data = new Uint8Array(24);
  const dv = new DataView(data.buffer);
  data.set(DISCRIMINATORS.create_deal, 0);
  dv.setBigUint64(8, args.dealId, true);
  dv.setBigUint64(16, args.amountLamports, true);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: deal, isSigner: false, isWritable: true },
      { pubkey: args.buyer, isSigner: true, isWritable: true },
      { pubkey: args.farmer, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

// ---- confirm_and_release ----------------------------------------------------

export interface ConfirmAndReleaseArgs {
  /** PDA of the deal being confirmed. */
  deal: PublicKey;
  /** The farmer wallet — must sign and receives the released lamports. */
  farmer: PublicKey;
}

export function makeConfirmAndReleaseIx(
  args: ConfirmAndReleaseArgs,
): TransactionInstruction {
  // disc(8) + no args = 8 bytes
  const data = new Uint8Array(8);
  data.set(DISCRIMINATORS.confirm_and_release, 0);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.deal, isSigner: false, isWritable: true },
      { pubkey: args.farmer, isSigner: true, isWritable: true },
    ],
    data: Buffer.from(data),
  });
}
