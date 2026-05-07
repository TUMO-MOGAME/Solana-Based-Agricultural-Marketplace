# scripts/

Utility / build scripts. Not part of the runtime.

## What lives here

| Script | Purpose |
|-|-|
| `build_proposal_pdf.py` | Renders `docs/proposal.pdf` from the embedded markdown source. |
| `build_one_pager.py` | Renders `docs/outreach/Vuna_one-pager.pdf` — the cold-email attachment. |
| `build_product_brief.py` | Renders `docs/outreach/Vuna_product-brief.pdf` — the follow-up attachment after a successful first call. |

## Usage

Run from the project root:

```bash
python scripts/build_proposal_pdf.py
```

The mockup builder lives in `design/build_mockups.py` because it's tightly coupled to design assets. Run it the same way:

```bash
python design/build_mockups.py
```

## Adding scripts

If you add a script, drop it here, document it in this README, and make sure it works with the project root as `cwd`.
