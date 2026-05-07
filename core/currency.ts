// Rand currency formatting.
// Uses Intl.NumberFormat under the hood for locale-correct grouping.

const FORMATTER = new Intl.NumberFormat("en-ZA", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** Format a whole-Rand amount as "R 1 655" (en-ZA grouping). */
export function formatRand(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error("amount must be a finite number");
  }
  const rounded = Math.round(amount);
  if (rounded < 0) {
    return `-R ${FORMATTER.format(-rounded)}`;
  }
  return `R ${FORMATTER.format(rounded)}`;
}

/** Format a Rand range, e.g. "R 1 500 – R 2 000". */
export function formatRandRange(low: number, high: number): string {
  return `${formatRand(low)} – ${formatRand(high)}`;
}
