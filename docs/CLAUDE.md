# docs/ — CLAUDE context

Narrative + reference docs for Project Vuna.

## What lives here

| File | Type | Purpose |
|-|-|-|
| `proposal.pdf` | generated | 12-page formal proposal. Source of truth for the project narrative. Regenerate via `python scripts/build_proposal_pdf.py`. |
| `source-paper.pdf` | source | Original research paper. Read-only — do not modify. |
| `architecture.md` | living doc | System design — on-chain programs, off-chain services, data flow. |
| `regulatory.md` | living doc | Detailed regulatory analysis. The non-negotiable list. |
| `phase-4-fund-a-farmer.md` | roadmap | Peer-to-peer 0%-return Grow Pack funding. **Roadmap only — not yet implemented.** Locks in the strict 0% principle before code starts. |
| `glossary.md` | living doc | Project vocabulary. Add terms as we coin them. |
| `presentation/Mazraat_albaan_speaking_script.pdf` | generated | Tumo's ~2 min speaker script for the global pitch. Solo-author framing. Regenerate via `python scripts/build_pitch.py`. |
| `presentation/Mazraat_albaan_slides.pdf` | generated | 10-slide 16:9 deck that screen-shares alongside the script. Same build script. |
| `presentation/slides/01..10.png` | generated | Individual slide PNGs (1920x1080) if needed separately. Same build script. |

## Rules

- If you add a new doc, update this file's table AND the project layout in the root `CLAUDE.md`.
- PDFs in this folder are generated artifacts. Edit the **source script** in `scripts/` or the **markdown source**, then regenerate. Do not hand-edit the PDF.
- Keep `architecture.md` aligned with what we are *actually* building. If the code drifts, fix the code or fix the doc — do not let them disagree.
