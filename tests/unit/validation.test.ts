// Tests for core/validation.ts
// Validation runs at the API boundary AND in the frontend before submission.
// Whatever rules these tests enforce, both sides must enforce identically.

import { describe, it, expect } from "vitest";
import {
  HECTARES_MAX,
  HECTARES_MIN,
  validateCrop,
  validateHectares,
  validateRegion,
} from "@core/validation.js";

describe("validateHectares", () => {
  it("accepts the proposal default of 2 ha", () => {
    expect(validateHectares(2)).toEqual({ ok: true });
  });

  it("accepts 2.5 ha (fractional)", () => {
    expect(validateHectares(2.5)).toEqual({ ok: true });
  });

  it("accepts the lower bound exactly", () => {
    expect(validateHectares(HECTARES_MIN)).toEqual({ ok: true });
  });

  it("accepts the upper bound exactly", () => {
    expect(validateHectares(HECTARES_MAX)).toEqual({ ok: true });
  });

  it("rejects below minimum", () => {
    const r = validateHectares(0.05);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/at least/);
  });

  it("rejects above maximum (not a smallholder)", () => {
    const r = validateHectares(100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/exceed/);
  });

  it("rejects NaN", () => {
    const r = validateHectares(Number.NaN);
    expect(r.ok).toBe(false);
  });

  it("rejects Infinity", () => {
    const r = validateHectares(Number.POSITIVE_INFINITY);
    expect(r.ok).toBe(false);
  });

  it("rejects negative", () => {
    const r = validateHectares(-1);
    expect(r.ok).toBe(false);
  });
});

describe("validateCrop", () => {
  it.each(["maize", "wheat", "soybean", "sorghum", "beans"])(
    "accepts %s",
    (crop) => {
      expect(validateCrop(crop)).toEqual({ ok: true });
    },
  );

  it("rejects an unsupported crop", () => {
    const r = validateCrop("tobacco");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Unsupported/);
  });

  it("rejects empty string", () => {
    expect(validateCrop("").ok).toBe(false);
  });

  it("is case-sensitive (we accept 'maize', not 'Maize')", () => {
    expect(validateCrop("Maize").ok).toBe(false);
  });
});

describe("validateRegion", () => {
  it.each([
    "eastern_cape", "kwazulu_natal", "limpopo", "mpumalanga",
    "free_state", "north_west", "western_cape", "northern_cape", "gauteng",
  ])("accepts %s", (region) => {
    expect(validateRegion(region)).toEqual({ ok: true });
  });

  it("rejects an unsupported region", () => {
    expect(validateRegion("transkei").ok).toBe(false);
  });

  it("rejects a country that is not South Africa", () => {
    expect(validateRegion("kenya_central").ok).toBe(false);
  });
});
