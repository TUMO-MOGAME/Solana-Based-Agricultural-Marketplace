# docs/ — CLAUDE context

Narrative + reference docs for Project Vuna.

## What lives here

| File | Type | Purpose |
|-|-|-|
| `proposal.pdf` | generated | 12-page formal proposal. Source of truth for the project narrative. Regenerate via `python scripts/build_proposal_pdf.py`. |
| `source-paper.pdf` | source | Original research paper. Read-only — do not modify. |
| `architecture.md` | living doc | System design — on-chain programs, off-chain services, data flow. |
| `regulatory.md` | living doc | Detailed regulatory analysis. The non-negotiable list. |
| `glossary.md` | living doc | Project vocabulary. Add terms as we coin them. |

## Rules

- If you add a new doc, update this file's table AND the project layout in the root `CLAUDE.md`.
- PDFs in this folder are generated artifacts. Edit the **source script** in `scripts/` or the **markdown source**, then regenerate. Do not hand-edit the PDF.
- Keep `architecture.md` aligned with what we are *actually* building. If the code drifts, fix the code or fix the doc — do not let them disagree.
