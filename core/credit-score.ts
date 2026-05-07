// Credit score arithmetic.
// Score is bounded to [300, 850] — the same banded range used by FICO/Experian
// so partner lenders can read it without conversion.

import type { CreditEvent, CreditScoreState } from "./types.js";

export const SCORE_MIN = 300;
export const SCORE_MAX = 850;
export const SCORE_INITIAL = 600;

const DELTAS = {
  successful_repayment: 20,
  default: -100,
  insurance_triggered: 0,
} as const;

export function newFarmerScore(): CreditScoreState {
  return {
    score: SCORE_INITIAL,
    totalPacks: 0,
    successfulRepayments: 0,
    defaults: 0,
    insuranceTriggers: 0,
  };
}

export function applyEvent(
  state: CreditScoreState,
  event: CreditEvent,
): CreditScoreState {
  const delta = DELTAS[event.kind];
  const next: CreditScoreState = {
    score: clamp(state.score + delta, SCORE_MIN, SCORE_MAX),
    totalPacks: state.totalPacks + 1,
    successfulRepayments:
      state.successfulRepayments + (event.kind === "successful_repayment" ? 1 : 0),
    defaults: state.defaults + (event.kind === "default" ? 1 : 0),
    insuranceTriggers:
      state.insuranceTriggers + (event.kind === "insurance_triggered" ? 1 : 0),
  };
  return next;
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
