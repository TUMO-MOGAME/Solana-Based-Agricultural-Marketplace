# Color palette

Used in `build_mockups.py` and (when scaffolded) in `app/`. Stay consistent. Do not introduce new colors without adding them here first.

## Tokens

| Token | Hex | Usage |
|-|-|-|
| `primary-green` | `#0B3D2E` | Primary surfaces, dark backgrounds, CTAs, brand mark |
| `primary-green-mid` | `#1F6B49` | Secondary green, charts, links on light backgrounds |
| `primary-green-soft` | `#E0EAE2` | Tinted green surfaces, success backgrounds |
| `gold` | `#E8B931` | Accent, primary CTA backgrounds, drought-payout hero |
| `gold-soft` | `#FAEBC3` | Gold-tinted card surfaces |
| `cream` | `#F5F2EA` | Page background |
| `card` | `#FFFFFF` | Card surfaces |
| `border` | `#E5E0D5` | Borders, dividers |
| `ink` | `#1A1A1A` | Primary text |
| `ink-soft` | `#666666` | Secondary text |
| `ink-faint` | `#A5A096` | Tertiary / disclosure text |
| `success` | `#2E7D32` | Success states, "On track" status |
| `warn` | `#E67E22` | Warnings, "Late inputs", drought trigger |
| `danger` | `#C0392B` | Errors, threshold lines |

## Tailwind config snippet

When `app/` is scaffolded, drop this into `tailwind.config.ts`:

```ts
theme: {
  extend: {
    colors: {
      'primary-green':       '#0B3D2E',
      'primary-green-mid':   '#1F6B49',
      'primary-green-soft':  '#E0EAE2',
      'gold':                '#E8B931',
      'gold-soft':           '#FAEBC3',
      'cream':               '#F5F2EA',
      'card':                '#FFFFFF',
      'border':              '#E5E0D5',
      'ink':                 '#1A1A1A',
      'ink-soft':            '#666666',
      'ink-faint':           '#A5A096',
      'success':             '#2E7D32',
      'warn':                '#E67E22',
      'danger':              '#C0392B',
    },
  },
},
```

## Typography

- **Display / headings:** Segoe UI Bold (Windows native) in mockups. In `app/`, use **Inter** as a free, web-friendly equivalent (Inter Bold for headings, Inter Regular for body).
- **Numerals (currency, scores):** Tabular figures. CSS: `font-variant-numeric: tabular-nums;`
