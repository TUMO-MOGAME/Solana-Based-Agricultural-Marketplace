# Project Vuna

**A Solana-based agricultural marketplace for South African smallholder farmers.**

Vuna gives small farmers seeds, fertilizer and drought insurance on credit, repaid at harvest. When bad weather hits, on-chain weather oracles trigger an instant insurance payout — no claim form, no waiting. The farmer never sees a wallet, a stablecoin, or the word "blockchain".

Built for the **Solana 2026 Frontier Hackathon — Physical World Applications track**.

**Authors:** Tumo Mogame & Pitsi Kgaume

---

## Quick links

- [Formal proposal (PDF)](docs/proposal.pdf) — problems, solution, tech, risks, roadmap
- [Source research paper](docs/source-paper.pdf) — the SATL framework Vuna is built on
- [Mobile mockup](design/mockups/mobile.png) — farmer phone app
- [Web mockup](design/mockups/web.png) — cooperative-officer dashboard
- [`CLAUDE.md`](CLAUDE.md) — internal project briefing (always loaded by Claude)

## Project layout

```
docs/        narrative documentation + PDFs
design/      UI mockups + design tokens
programs/    Solana / Anchor smart contracts
app/         Next.js frontend (farmer + co-op)
api/         Node.js backend
scripts/     utility build scripts
```

Each major folder has its own `CLAUDE.md` with sub-context.

## Development status

We are in pre-code planning. `programs/`, `app/` and `api/` are empty scaffolds. The build phase begins after the proposal review and cooperative outreach.

See `CLAUDE.md` §13 for a live status checklist.

## Why this exists

Smallholders grow ~70% of African food but receive under 5% of bank lending. One bad rainy season and a family sells a cow to eat. Vuna is one attempt to close that gap, honestly and slowly.

This is development infrastructure, not a unicorn pitch. Read `docs/proposal.pdf` §7 (Disadvantages) and §8 (Challenges) before getting excited about anything.
