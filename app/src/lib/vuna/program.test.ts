// Tests for the Vuna program client.
//
// We focus on the things that, if wrong, will silently produce broken
// transactions: discriminator bytes, args byte layout, and the order /
// flags of account metas. PDA derivation is tested too — wrong seeds are
// the most common bug.

import { describe, it, expect } from "vitest";
import { PublicKey, SystemProgram } from "@solana/web3.js";

import {
  PROGRAM_ID,
  farmerPda,
  packPda,
  quoteGrowPack,
  SERVICE_FEE_BPS_DEFAULT,
  makeRegisterFarmerIx,
  makeRequestGrowPackIx,
} from "./program";

// Stable test fixtures
const COOP = new PublicKey("11111111111111111111111111111112");
const FARMER_ID_HASH = new Uint8Array(32).fill(7);
const SEASON_ID = 2026;

// ============================================================================
//  PDA derivation
// ============================================================================

describe("PDA derivation", () => {
  it("farmerPda is deterministic for (coop, hash)", () => {
    const [a] = farmerPda(COOP, FARMER_ID_HASH);
    const [b] = farmerPda(COOP, FARMER_ID_HASH);
    expect(a.toBase58()).toBe(b.toBase58());
  });

  it("farmerPda differs across cooperatives", () => {
    const [a] = farmerPda(COOP, FARMER_ID_HASH);
    const otherCoop = new PublicKey("11111111111111111111111111111113");
    const [b] = farmerPda(otherCoop, FARMER_ID_HASH);
    expect(a.toBase58()).not.toBe(b.toBase58());
  });

  it("farmerPda rejects a hash that isn't 32 bytes", () => {
    expect(() => farmerPda(COOP, new Uint8Array(31))).toThrow(/32 bytes/);
  });

  it("packPda is deterministic for (farmer, seasonId)", () => {
    const [farmer] = farmerPda(COOP, FARMER_ID_HASH);
    const [a] = packPda(farmer, SEASON_ID);
    const [b] = packPda(farmer, SEASON_ID);
    expect(a.toBase58()).toBe(b.toBase58());
  });

  it("packPda differs across season ids", () => {
    const [farmer] = farmerPda(COOP, FARMER_ID_HASH);
    const [a] = packPda(farmer, 2026);
    const [b] = packPda(farmer, 2027);
    expect(a.toBase58()).not.toBe(b.toBase58());
  });
});

// ============================================================================
//  Pricing math (mirrors core/grow-pack.ts tests one-for-one)
// ============================================================================

describe("quoteGrowPack", () => {
  it("matches the proposal's R 1 655 / R 165 / R 1 820 numbers", () => {
    const q = quoteGrowPack(420, 1150, 85, 1000);
    expect(q.bundleCost).toBe(1655);
    expect(q.serviceFee).toBe(165);
    expect(q.totalRepayment).toBe(1820);
  });

  it("default service fee bps is 1000 (10%)", () => {
    expect(SERVICE_FEE_BPS_DEFAULT).toBe(1000);
  });

  it("zero service fee leaves bundle == total", () => {
    const q = quoteGrowPack(500, 500, 100, 0);
    expect(q.serviceFee).toBe(0);
    expect(q.totalRepayment).toBe(q.bundleCost);
  });

  it("floors fractional fee cents", () => {
    // 333 * 1000 / 10000 = 33.3 → 33
    const q = quoteGrowPack(333, 0, 0, 1000);
    expect(q.serviceFee).toBe(33);
    expect(q.totalRepayment).toBe(366);
  });
});

// ============================================================================
//  register_farmer encoder
// ============================================================================

describe("makeRegisterFarmerIx", () => {
  const args = {
    cooperative: COOP,
    farmerIdHash: FARMER_ID_HASH,
    region: 0,
  };

  it("is addressed to the Vuna program", () => {
    const ix = makeRegisterFarmerIx(args);
    expect(ix.programId.toBase58()).toBe(PROGRAM_ID.toBase58());
  });

  it("data is exactly 41 bytes (8 disc + 32 hash + 1 region)", () => {
    expect(makeRegisterFarmerIx(args).data.length).toBe(41);
  });

  it("starts with the register_farmer discriminator", () => {
    const ix = makeRegisterFarmerIx(args);
    const expected = [63, 234, 139, 94, 48, 7, 57, 201];
    expect(Array.from(ix.data.slice(0, 8))).toEqual(expected);
  });

  it("encodes the farmer_id_hash + region after the discriminator", () => {
    const ix = makeRegisterFarmerIx(args);
    expect(Array.from(ix.data.slice(8, 40))).toEqual(Array.from(FARMER_ID_HASH));
    expect(ix.data[40]).toBe(0);
  });

  it("places the FarmerAccount PDA writable in slot 0", () => {
    const ix = makeRegisterFarmerIx(args);
    const [farmer] = farmerPda(args.cooperative, args.farmerIdHash);
    expect(ix.keys[0].pubkey.toBase58()).toBe(farmer.toBase58());
    expect(ix.keys[0].isWritable).toBe(true);
    expect(ix.keys[0].isSigner).toBe(false);
  });

  it("places the cooperative as signer + writable in slot 1", () => {
    const ix = makeRegisterFarmerIx(args);
    expect(ix.keys[1].pubkey.toBase58()).toBe(COOP.toBase58());
    expect(ix.keys[1].isSigner).toBe(true);
    expect(ix.keys[1].isWritable).toBe(true);
  });

  it("places the system program in slot 2", () => {
    const ix = makeRegisterFarmerIx(args);
    expect(ix.keys[2].pubkey.toBase58()).toBe(SystemProgram.programId.toBase58());
    expect(ix.keys[2].isSigner).toBe(false);
    expect(ix.keys[2].isWritable).toBe(false);
  });

  it("rejects a hash that isn't 32 bytes", () => {
    expect(() =>
      makeRegisterFarmerIx({ ...args, farmerIdHash: new Uint8Array(31) }),
    ).toThrow(/32 bytes/);
  });
});

// ============================================================================
//  request_grow_pack encoder
// ============================================================================

describe("makeRequestGrowPackIx", () => {
  const args = {
    cooperative: COOP,
    farmerIdHash: FARMER_ID_HASH,
    seasonId: SEASON_ID,
    seedCost: 420n,
    fertilizerCost: 1_150n,
    insuranceCost: 85n,
    serviceFeeBps: 1000,
    thresholdPercent: 80,
    maxPayout: 1_750n,
  };

  it("data is exactly 47 bytes (8 disc + args)", () => {
    expect(makeRequestGrowPackIx(args).data.length).toBe(47);
  });

  it("starts with the request_grow_pack discriminator", () => {
    const ix = makeRequestGrowPackIx(args);
    const expected = [87, 250, 138, 80, 99, 29, 254, 240];
    expect(Array.from(ix.data.slice(0, 8))).toEqual(expected);
  });

  it("encodes seasonId as little-endian u32 at offset 8", () => {
    const ix = makeRequestGrowPackIx(args);
    const dv = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
    expect(dv.getUint32(8, true)).toBe(SEASON_ID);
  });

  it("encodes the proposal R 420 / R 1 150 / R 85 / 1000 bps / 80% / R 1 750", () => {
    const ix = makeRequestGrowPackIx(args);
    const dv = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
    expect(dv.getBigUint64(12, true)).toBe(420n);
    expect(dv.getBigUint64(20, true)).toBe(1_150n);
    expect(dv.getBigUint64(28, true)).toBe(85n);
    expect(dv.getUint16(36, true)).toBe(1000);
    expect(dv.getUint8(38)).toBe(80);
    expect(dv.getBigUint64(39, true)).toBe(1_750n);
  });

  it("places the GrowPack PDA writable in slot 0", () => {
    const ix = makeRequestGrowPackIx(args);
    const [farmer] = farmerPda(args.cooperative, args.farmerIdHash);
    const [pack] = packPda(farmer, args.seasonId);
    expect(ix.keys[0].pubkey.toBase58()).toBe(pack.toBase58());
    expect(ix.keys[0].isWritable).toBe(true);
    expect(ix.keys[0].isSigner).toBe(false);
  });

  it("places the FarmerAccount PDA read-only in slot 1", () => {
    const ix = makeRequestGrowPackIx(args);
    const [farmer] = farmerPda(args.cooperative, args.farmerIdHash);
    expect(ix.keys[1].pubkey.toBase58()).toBe(farmer.toBase58());
    expect(ix.keys[1].isWritable).toBe(false);
    expect(ix.keys[1].isSigner).toBe(false);
  });

  it("places the cooperative as signer + writable in slot 2", () => {
    const ix = makeRequestGrowPackIx(args);
    expect(ix.keys[2].pubkey.toBase58()).toBe(COOP.toBase58());
    expect(ix.keys[2].isSigner).toBe(true);
    expect(ix.keys[2].isWritable).toBe(true);
  });

  it("places the system program in slot 3", () => {
    const ix = makeRequestGrowPackIx(args);
    expect(ix.keys[3].pubkey.toBase58()).toBe(SystemProgram.programId.toBase58());
  });
});
