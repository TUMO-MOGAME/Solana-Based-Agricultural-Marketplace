// Input validation for farmer-submitted Grow Pack requests.

import type { Crop, Region } from "./types.js";

export const HECTARES_MIN = 0.1;
export const HECTARES_MAX = 50;

const CROPS: ReadonlySet<Crop> = new Set([
  "maize", "wheat", "soybean", "sorghum", "beans",
]);

const REGIONS: ReadonlySet<Region> = new Set([
  "eastern_cape", "kwazulu_natal", "limpopo", "mpumalanga",
  "free_state", "north_west", "western_cape", "northern_cape", "gauteng",
]);

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateHectares(hectares: number): ValidationResult {
  if (!Number.isFinite(hectares)) {
    return { ok: false, reason: "Hectares must be a finite number" };
  }
  if (hectares < HECTARES_MIN) {
    return { ok: false, reason: `Hectares must be at least ${HECTARES_MIN}` };
  }
  if (hectares > HECTARES_MAX) {
    return { ok: false, reason: `Hectares must not exceed ${HECTARES_MAX}` };
  }
  return { ok: true };
}

export function validateCrop(crop: string): ValidationResult {
  if (!CROPS.has(crop as Crop)) {
    return { ok: false, reason: `Unsupported crop: ${crop}` };
  }
  return { ok: true };
}

export function validateRegion(region: string): ValidationResult {
  if (!REGIONS.has(region as Region)) {
    return { ok: false, reason: `Unsupported region: ${region}` };
  }
  return { ok: true };
}
