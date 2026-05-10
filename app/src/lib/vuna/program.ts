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
const OFFER_SEED = Buffer.from("offer");

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

/**
 * Derive the BuyerOffer PDA for (buyer, offer_id). Phase 3 marketplace.
 * Mirrors `programs/vuna/programs/vuna/src/instructions/post_buyer_offer.rs`.
 */
export function buyerOfferPda(
  buyer: PublicKey,
  offerId: bigint,
): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(offerId, 0);
  return PublicKey.findProgramAddressSync(
    [OFFER_SEED, buyer.toBuffer(), idBuf],
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
  // Marketplace (Phase 3)
  post_buyer_offer: new Uint8Array([230, 36, 254, 173, 171, 182, 172, 92]),
  cancel_buyer_offer: new Uint8Array([86, 233, 63, 2, 145, 114, 3, 88]),
} as const;

/** Anchor account-discriminator for the Deal account type. */
const DEAL_ACCOUNT_DISC = new Uint8Array([125, 223, 160, 234, 71, 162, 182, 219]);

/** Anchor account-discriminator for the BuyerOffer account type. */
const BUYER_OFFER_ACCOUNT_DISC = new Uint8Array([124, 127, 189, 174, 44, 105, 164, 195]);

/** Anchor account-discriminator for the GrowPack account type. */
const GROW_PACK_ACCOUNT_DISC = new Uint8Array([62, 131, 53, 159, 191, 11, 217, 208]);

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

// ---- approve_grow_pack ------------------------------------------------------
//
// Co-op-side instruction. Caller has already scanned the program for packs
// in `Requested` status, so they pass the pack PDA + farmer PDA directly
// rather than re-deriving from the farmer hash (which the co-op may not
// have on hand for an unknown farmer's application).

export interface ApproveGrowPackArgs {
  /** Co-op signer — must equal `farmer.cooperative` on-chain. */
  cooperative: PublicKey;
  /** FarmerAccount PDA the pack belongs to. */
  farmer: PublicKey;
  /** GrowPack PDA being approved. */
  pack: PublicKey;
}

export function makeApproveGrowPackIx(
  args: ApproveGrowPackArgs,
): TransactionInstruction {
  const data = new Uint8Array(8);
  data.set(DISCRIMINATORS.approve_grow_pack, 0);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.pack, isSigner: false, isWritable: true },
      { pubkey: args.farmer, isSigner: false, isWritable: false },
      { pubkey: args.cooperative, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

// ---- disburse_grow_pack -----------------------------------------------------
//
// Identical account ordering and data layout to approve_grow_pack — only
// the discriminator differs. Inputs delivered → status Approved → Active.

export type DisburseGrowPackArgs = ApproveGrowPackArgs;

export function makeDisburseGrowPackIx(
  args: DisburseGrowPackArgs,
): TransactionInstruction {
  const data = new Uint8Array(8);
  data.set(DISCRIMINATORS.disburse_grow_pack, 0);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.pack, isSigner: false, isWritable: true },
      { pubkey: args.farmer, isSigner: false, isWritable: false },
      { pubkey: args.cooperative, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

// ---- trigger_insurance_payout -----------------------------------------------
//
// Co-op (or future underwriter signer) attests an observed rainfall %.
// On-chain program computes the payout itself via ParametricPolicy::evaluate_payout
// — caller can't inflate the amount. See trigger_insurance_payout.rs.

export interface TriggerInsurancePayoutArgs extends ApproveGrowPackArgs {
  /** Observed rainfall as a percentage of the seasonal norm (0–255). */
  rainfallPercent: number;
}

export function makeTriggerInsurancePayoutIx(
  args: TriggerInsurancePayoutArgs,
): TransactionInstruction {
  if (args.rainfallPercent < 0 || args.rainfallPercent > 255) {
    throw new Error("rainfallPercent must fit in a u8 (0–255)");
  }
  // disc(8) + rainfall_percent(1) = 9 bytes
  const data = new Uint8Array(9);
  data.set(DISCRIMINATORS.trigger_insurance_payout, 0);
  data[8] = args.rainfallPercent & 0xff;
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.pack, isSigner: false, isWritable: true },
      { pubkey: args.farmer, isSigner: false, isWritable: false },
      { pubkey: args.cooperative, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

// ---- fetchAllGrowPacks ------------------------------------------------------
//
// Scans every GrowPack PDA owned by the program. Used by /coop/* to build
// the pending / awaiting-disbursement / active queues. Same wasteful pattern
// as fetchAllBuyerOffers — fine for the hackathon, indexer in production.
//
// Optional `status` filter is applied client-side after the Borsh decode.

export async function fetchAllGrowPacks(
  connection: Connection,
  status?: GrowPackStatus | GrowPackStatus[],
): Promise<{ address: PublicKey; pack: GrowPack }[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID);
  const wanted = status === undefined
    ? null
    : new Set(Array.isArray(status) ? status : [status]);

  const out: { address: PublicKey; pack: GrowPack }[] = [];
  for (const { pubkey, account } of accounts) {
    if (account.data.length < 8 + 1) continue;
    let match = true;
    for (let i = 0; i < 8; i++) {
      if (account.data[i] !== GROW_PACK_ACCOUNT_DISC[i]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    let pack: GrowPack;
    try {
      pack = decodeGrowPack(account.data);
    } catch {
      continue;
    }
    if (wanted && !wanted.has(pack.status)) continue;
    out.push({ address: pubkey, pack });
  }
  return out;
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

/**
 * Find every live Deal PDA where the given wallet is either buyer or
 * farmer. Used by the marketplace tab to recover deal state in a fresh
 * browser (no localStorage), or when localStorage is split across
 * machines / browsers / Phantom profiles.
 *
 * Wasteful at scale (scans every program-owned account, filters in JS)
 * but fine for hackathon devnet load. Production would either use a
 * memcmp filter on (discriminator + buyer/farmer offset) or run an
 * indexer.
 */
export async function fetchDealsByWallet(
  connection: Connection,
  wallet: PublicKey,
): Promise<{ address: PublicKey; deal: Deal }[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID);
  const out: { address: PublicKey; deal: Deal }[] = [];
  for (const { pubkey, account } of accounts) {
    if (account.data.length < 8 + 89) continue;
    let match = true;
    for (let i = 0; i < 8; i++) {
      if (account.data[i] !== DEAL_ACCOUNT_DISC[i]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    try {
      const deal = decodeDeal(account.data);
      if (deal.buyer.equals(wallet) || deal.farmer.equals(wallet)) {
        out.push({ address: pubkey, deal });
      }
    } catch {
      /* malformed Deal — skip */
    }
  }
  return out;
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

// ============================================================================
//  Marketplace — BuyerOffer (Phase 3) + post + cancel
//
//  Mirrors `programs/vuna/programs/vuna/src/state.rs::BuyerOffer` and the
//  two instruction modules at instructions/{post_buyer_offer,cancel_buyer_offer}.rs
// ============================================================================

/** Crop enum codes — must match the BuyerOffer.crop u8 stored on-chain. */
export const CROP_LABELS = ["Maize", "Wheat", "Soybean", "Sorghum", "Beans"] as const;
export type CropLabel = (typeof CROP_LABELS)[number];

/** Region enum codes — same as core/types.ts Region order. */
export const REGION_LABELS = [
  "Eastern Cape",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Free State",
  "North West",
  "Western Cape",
  "Northern Cape",
  "Gauteng",
] as const;
export type RegionLabel = (typeof REGION_LABELS)[number];

/** Buyer-type enum codes — must match BuyerOffer.buyer_type. */
export const BUYER_TYPE_LABELS = [
  "Mill",
  "Retailer",
  "Co-op",
  "Brewer",
  "Exporter",
] as const;
export type BuyerTypeLabel = (typeof BUYER_TYPE_LABELS)[number];

export interface BuyerOffer {
  buyer: PublicKey;
  offerId: bigint;
  crop: number;
  region: number;
  buyerType: number;
  maxQuantityTons: number;
  pricePerTonZar: bigint;
  middlemanPriceZar: bigint;
  createdAt: bigint;
  expiresAt: bigint;
  buyerName: string;
  bump: number;
}

/** Borsh layout: 32 + 8 + 1 + 1 + 1 + 4 + 8 + 8 + 8 + 8 + 32 + 1 = 112 bytes. */
export function decodeBuyerOffer(data: Uint8Array): BuyerOffer {
  if (data.length < 8 + 112) {
    throw new Error(`BuyerOffer account too small: ${data.length} bytes`);
  }
  for (let i = 0; i < 8; i++) {
    if (data[i] !== BUYER_OFFER_ACCOUNT_DISC[i]) {
      throw new Error("BuyerOffer: account-discriminator mismatch");
    }
  }
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8;
  const buyer = new PublicKey(data.slice(o, o + 32)); o += 32;
  const offerId = dv.getBigUint64(o, true); o += 8;
  const crop = dv.getUint8(o); o += 1;
  const region = dv.getUint8(o); o += 1;
  const buyerType = dv.getUint8(o); o += 1;
  const maxQuantityTons = dv.getUint32(o, true); o += 4;
  const pricePerTonZar = dv.getBigUint64(o, true); o += 8;
  const middlemanPriceZar = dv.getBigUint64(o, true); o += 8;
  const createdAt = dv.getBigInt64(o, true); o += 8;
  const expiresAt = dv.getBigInt64(o, true); o += 8;
  // Decode the 32-byte name buffer as null-padded ASCII/UTF-8.
  const nameBytes = data.slice(o, o + 32); o += 32;
  const nullIdx = nameBytes.indexOf(0);
  const trimmed = nullIdx >= 0 ? nameBytes.slice(0, nullIdx) : nameBytes;
  const buyerName = new TextDecoder().decode(trimmed);
  const bump = dv.getUint8(o);
  return {
    buyer, offerId, crop, region, buyerType,
    maxQuantityTons, pricePerTonZar, middlemanPriceZar,
    createdAt, expiresAt, buyerName, bump,
  };
}

export async function fetchBuyerOffer(
  connection: Connection,
  offer: PublicKey,
): Promise<BuyerOffer | null> {
  const info = await connection.getAccountInfo(offer);
  if (!info) return null;
  return decodeBuyerOffer(info.data);
}

/**
 * Fetch every BuyerOffer currently posted to the program. Uses
 * getProgramAccounts and filters client-side by the BuyerOffer
 * account discriminator.
 *
 * Wasteful at scale but fine for a hackathon demo with a handful of
 * accounts. Production would either run an indexer or use a memcmp
 * filter on the discriminator (requires bs58 encoding the bytes).
 */
export async function fetchAllBuyerOffers(
  connection: Connection,
): Promise<{ address: PublicKey; offer: BuyerOffer }[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID);
  const out: { address: PublicKey; offer: BuyerOffer }[] = [];
  for (const { pubkey, account } of accounts) {
    if (account.data.length < 8 + 112) continue;
    let match = true;
    for (let i = 0; i < 8; i++) {
      if (account.data[i] !== BUYER_OFFER_ACCOUNT_DISC[i]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    try {
      out.push({ address: pubkey, offer: decodeBuyerOffer(account.data) });
    } catch {
      /* malformed — skip */
    }
  }
  return out;
}

/** Encode an ASCII display name into a fixed-size 32-byte null-padded buffer. */
export function encodeBuyerName(name: string): Uint8Array {
  const buf = new Uint8Array(32);
  const bytes = new TextEncoder().encode(name);
  buf.set(bytes.slice(0, 32), 0);
  return buf;
}

// ---- post_buyer_offer -------------------------------------------------------

export interface PostBuyerOfferArgs {
  buyer: PublicKey;
  offerId: bigint;
  crop: number;
  region: number;
  buyerType: number;
  maxQuantityTons: number;
  pricePerTonZar: bigint;
  middlemanPriceZar: bigint;
  expiresAt: bigint;
  buyerName: string;
}

export function makePostBuyerOfferIx(
  args: PostBuyerOfferArgs,
): TransactionInstruction {
  const [offer] = buyerOfferPda(args.buyer, args.offerId);

  // disc(8) + offer_id(8) + crop(1) + region(1) + buyer_type(1)
  // + max_qty(4) + price(8) + middleman(8) + expires_at(8)
  // + buyer_name(32) = 79 bytes
  const data = new Uint8Array(79);
  const dv = new DataView(data.buffer);
  data.set(DISCRIMINATORS.post_buyer_offer, 0);
  let o = 8;
  dv.setBigUint64(o, args.offerId, true); o += 8;
  dv.setUint8(o, args.crop & 0xff); o += 1;
  dv.setUint8(o, args.region & 0xff); o += 1;
  dv.setUint8(o, args.buyerType & 0xff); o += 1;
  dv.setUint32(o, args.maxQuantityTons, true); o += 4;
  dv.setBigUint64(o, args.pricePerTonZar, true); o += 8;
  dv.setBigUint64(o, args.middlemanPriceZar, true); o += 8;
  dv.setBigInt64(o, args.expiresAt, true); o += 8;
  data.set(encodeBuyerName(args.buyerName), o);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: offer, isSigner: false, isWritable: true },
      { pubkey: args.buyer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

// ---- cancel_buyer_offer -----------------------------------------------------

export interface CancelBuyerOfferArgs {
  /** PDA of the offer being cancelled. */
  offer: PublicKey;
  /** Original buyer who posted it — must sign and receives rent refund. */
  buyer: PublicKey;
}

export function makeCancelBuyerOfferIx(
  args: CancelBuyerOfferArgs,
): TransactionInstruction {
  // disc(8) + no args = 8 bytes
  const data = new Uint8Array(8);
  data.set(DISCRIMINATORS.cancel_buyer_offer, 0);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.offer, isSigner: false, isWritable: true },
      { pubkey: args.buyer, isSigner: true, isWritable: true },
    ],
    data: Buffer.from(data),
  });
}
