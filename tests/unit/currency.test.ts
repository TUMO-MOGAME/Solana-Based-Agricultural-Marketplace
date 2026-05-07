// Tests for core/currency.ts
// Every screen the farmer sees is in Rand. Format must be consistent everywhere.
// We use en-ZA grouping (space as thousands separator) to match SA convention.

import { describe, it, expect } from "vitest";
import { formatRand, formatRandRange } from "@core/currency.js";

// en-ZA's NumberFormat uses U+00A0 (non-breaking space) as thousands separator.
// Tests assert that it's a single character of "white-space-ish-ness", not a literal " ".
const NBSP = " ";

describe("formatRand: basics", () => {
  it("formats zero as 'R 0'", () => {
    expect(formatRand(0)).toBe("R 0");
  });

  it("formats single digits without grouping", () => {
    expect(formatRand(5)).toBe("R 5");
  });

  it("formats hundreds without grouping", () => {
    expect(formatRand(420)).toBe("R 420");
  });

  it("formats thousands with grouping (en-ZA convention)", () => {
    // en-ZA uses non-breaking space as thousands separator
    expect(formatRand(1655)).toBe(`R 1${NBSP}655`);
  });

  it("formats millions correctly", () => {
    expect(formatRand(2_840_500)).toBe(`R 2${NBSP}840${NBSP}500`);
  });
});

describe("formatRand: rounding", () => {
  it("rounds .49 down", () => {
    expect(formatRand(1655.49)).toBe(`R 1${NBSP}655`);
  });

  it("rounds .50 up", () => {
    expect(formatRand(1655.5)).toBe(`R 1${NBSP}656`);
  });
});

describe("formatRand: negative numbers", () => {
  it("renders negative as '-R 100'", () => {
    expect(formatRand(-100)).toBe("-R 100");
  });

  it("handles negative thousands", () => {
    expect(formatRand(-1655)).toBe(`-R 1${NBSP}655`);
  });
});

describe("formatRand: validation", () => {
  it("rejects NaN", () => {
    expect(() => formatRand(Number.NaN)).toThrow(/finite/);
  });

  it("rejects Infinity", () => {
    expect(() => formatRand(Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });
});

describe("formatRandRange", () => {
  it("formats a range with em-dash", () => {
    expect(formatRandRange(1500, 2000)).toBe(`R 1${NBSP}500 – R 2${NBSP}000`);
  });

  it("formats the proposal pilot range (R 75 000 – R 150 000)", () => {
    expect(formatRandRange(75_000, 150_000)).toBe(
      `R 75${NBSP}000 – R 150${NBSP}000`,
    );
  });
});
