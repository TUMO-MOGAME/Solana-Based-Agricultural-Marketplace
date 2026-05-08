// Tiny localStorage cache for marketplace deals created in this browser.
//
// Why we need this: Phase 2 deals are PDAs derived from
// (buyer, farmer, deal_id). Without an off-chain index we can't easily
// query "all deals where farmer = X" — we'd need to scan every deal
// id ever issued. For the hackathon demo we side-step that by saving
// every deal we create from this browser to localStorage; both halves
// of the demo (buyer side AND farmer side) read from the same browser
// and so see the same deal list.
//
// In production, an indexer or a `DealIndex` PDA per (buyer, farmer)
// would replace this. Out of scope for the demo.

const STORAGE_KEY = "vuna.demoDeals";

/**
 * A deal record as we cache it. `dealId` and `amountLamports` are
 * stored as decimal strings because JSON.stringify can't natively
 * round-trip BigInts.
 */
export type DemoDeal = {
  pda: string;
  buyer: string;
  farmer: string;
  /** Buyer-chosen deal id (u64 as a decimal string). */
  dealId: string;
  /** Locked lamports (u64 as a decimal string). */
  amountLamports: string;
  /** Unix milliseconds when the buyer signed the create_deal tx. */
  createdAtMs: number;
  /** What the buyer was matching against — a row from the marketplace. */
  buyerOfferLabel?: string;
  /** Tx signature of the create_deal call. */
  createSignature?: string;
};

export function readDemoDeals(): DemoDeal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDemoDeal);
  } catch {
    return [];
  }
}

function isDemoDeal(x: unknown): x is DemoDeal {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.pda === "string" &&
    typeof o.buyer === "string" &&
    typeof o.farmer === "string" &&
    typeof o.dealId === "string" &&
    typeof o.amountLamports === "string" &&
    typeof o.createdAtMs === "number"
  );
}

export function addDemoDeal(deal: DemoDeal): void {
  if (typeof window === "undefined") return;
  try {
    const current = readDemoDeals().filter((d) => d.pda !== deal.pda);
    current.unshift(deal);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
}

export function removeDemoDeal(pda: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = readDemoDeals().filter((d) => d.pda !== pda);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
}

/** Generate a random u64 deal id as a decimal string. */
export function randomDealId(): string {
  // 53 bits via Math.random is plenty of room — collisions are
  // practically impossible for a demo with a handful of deals.
  const hi = Math.floor(Math.random() * 0xffffffff);
  const lo = Math.floor(Math.random() * 0xffffffff);
  return ((BigInt(hi) << 32n) | BigInt(lo)).toString();
}
