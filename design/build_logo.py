"""
Resize the Mazra'at albaan logo source into the sizes the project needs,
and fan it out to the canonical paths under app/.

The source is `design/logo-source.png` — the picked Imagen variant
(logo-gen-botanical-emblem). To regenerate fresh source variants, run
`scripts/generate_logo.py` (needs GEMINI_API_KEY).

Run from anywhere: `python design/build_logo.py`

Outputs:
  design/logo-mark-1024.png   1024x1024 main asset (hackathon submission)
  design/logo-mark-512.png     512x512 medium
  design/logo-mark-256.png     256x256 thumbnail
  design/logo-mark-64.png       64x64 favicon-sized
  app/public/brand/logo-mark-256.png   copy for the frontend
  app/public/brand/logo-mark-512.png   copy for the frontend
  app/src/app/icon.png                  Next.js auto-favicon (= 256px)
"""

from PIL import Image
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "design", "logo-source.png")

DESIGN_DIR = os.path.join(ROOT, "design")
APP_BRAND = os.path.join(ROOT, "app", "public", "brand")
APP_ICON = os.path.join(ROOT, "app", "src", "app", "icon.png")

SIZES = (1024, 512, 256, 64)


def main():
    if not os.path.exists(SRC):
        raise SystemExit(
            f"missing source: {SRC}\n"
            "Run scripts/generate_logo.py to produce candidates, then copy "
            "the picked one to design/logo-source.png."
        )

    src = Image.open(SRC).convert("RGB")
    if src.size != (1024, 1024):
        src = src.resize((1024, 1024), Image.LANCZOS)

    for size in SIZES:
        out = os.path.join(DESIGN_DIR, f"logo-mark-{size}.png")
        src.resize((size, size), Image.LANCZOS).save(out, optimize=True)
        print(f"  wrote {out} ({os.path.getsize(out) // 1024} KB)")

    for size in (256, 512):
        dest = os.path.join(APP_BRAND, f"logo-mark-{size}.png")
        shutil.copy(os.path.join(DESIGN_DIR, f"logo-mark-{size}.png"), dest)
        print(f"  copied -> {dest}")

    shutil.copy(os.path.join(DESIGN_DIR, "logo-mark-256.png"), APP_ICON)
    print(f"  copied -> {APP_ICON}  (favicon)")


if __name__ == "__main__":
    main()
