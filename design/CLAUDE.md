# design/ — CLAUDE context

UI design assets and tokens for Project Vuna.

## What lives here

| File | Purpose |
|-|-|
| `palette.md` | Color tokens. Tailwind-ready. The single source of truth. |
| `build_mockups.py` | Renders the mockups using PIL. Run from anywhere: `python design/build_mockups.py`. |
| `mockups/mobile.png` | Generated. 4 phone screens: welcome, home, apply, drought payout. |
| `mockups/web.png` | Generated. Cooperative-officer dashboard. |

## Rules

- **Mobile-first.** The farmer is on a phone, often a low-end Android.
- **Hide the chain.** No "wallet", "blockchain", "stablecoin", "USDC", "Solana" anywhere a farmer sees. Always show Rand.
- **Earthy palette only.** Stay inside the tokens in `palette.md`. Don't introduce new colors casually.
- **Do not hand-edit `mockups/*.png`** — they are regenerable. Edit `build_mockups.py` and re-run.
- **The "Drought payout" screen is the marketing screen.** Lead every demo with it.

## When `app/` is scaffolded

Wire `palette.md` into `app/tailwind.config.ts` so the colors stay synchronised between mockups and production UI.
