"""
Generates the Mazra'at albaan project banner.

Run from anywhere: `python design/build_banner.py`

Output (into design/):
  banner-3x1.png    1500x500 — primary 3:1 banner (GitHub repo, hackathon submission)
  banner-4x1.png    1600x400 — wider 4:1 banner (Twitter/X header, marketing)

Palette: earthy tokens from design/palette.md. Mark reused from build_logo.py.
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os, sys

# Reuse the logo mark renderer + palette constants
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_logo import render as render_mark, GREEN, GOLD

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "design")

CREAM      = (245, 242, 234, 255)
CREAM_DIM  = (245, 242, 234, 165)
GREEN_DEEP = (8, 45, 33, 255)        # darker than primary-green for vignette


def find_font(size: int, bold: bool = False):
    """Try a few likely-installed sans fonts, fall back to PIL default."""
    candidates_bold = [
        "segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf", "Helvetica-Bold.ttf",
    ]
    candidates_regular = [
        "segoeui.ttf", "arial.ttf", "DejaVuSans.ttf", "Helvetica.ttf",
    ]
    for name in (candidates_bold if bold else candidates_regular):
        try:
            return ImageFont.truetype(name, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def render_banner(width: int, height: int) -> Image.Image:
    # 2x supersample, downsample with LANCZOS for clean text + edges
    sw, sh = width * 2, height * 2

    img = Image.new("RGBA", (sw, sh), GREEN)
    d = ImageDraw.Draw(img)

    # Soft vignette in the corners — hint of depth without busyness
    vignette = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    vd.rectangle((0, 0, sw, sh), fill=(*GREEN_DEEP[:3], 90))
    inner_pad = int(sh * 0.05)
    vd.rectangle((inner_pad, inner_pad, sw - inner_pad, sh - inner_pad),
                 fill=(0, 0, 0, 0))
    vignette = vignette.filter(ImageFilter.GaussianBlur(radius=int(sh * 0.18)))
    img.alpha_composite(vignette)

    # Warm gold glow behind the logo
    glow = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    glow_cx = int(sw * 0.21)
    glow_cy = sh // 2
    glow_r = int(sh * 0.58)
    gd.ellipse((glow_cx - glow_r, glow_cy - glow_r,
                glow_cx + glow_r, glow_cy + glow_r),
               fill=(*GOLD, 55))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=int(sh / 5)))
    img.alpha_composite(glow)

    # Logo mark — left side, vertically centered
    mark_size = int(sh * 0.78)
    mark = render_mark(mark_size)
    mark_x = int(sh * 0.11)
    mark_y = (sh - mark_size) // 2
    img.alpha_composite(mark, (mark_x, mark_y))

    # Text block to the right of the mark
    text_x = mark_x + mark_size + int(sh * 0.14)

    # Wordmark
    wm_size = int(sh * 0.20)
    wm_font = find_font(wm_size, bold=True)
    d.text((text_x, int(sh * 0.36)), "Mazra'at albaan",
           font=wm_font, fill=CREAM, anchor="lm")

    # Tagline (gold)
    tag_size = int(sh * 0.058)
    tag_font = find_font(tag_size, bold=False)
    d.text((text_x, int(sh * 0.54)), "Seeds · Credit · Insurance — repaid at harvest",
           font=tag_font, fill=(*GOLD, 255), anchor="lm")

    # Hackathon footer
    foot_size = int(sh * 0.038)
    foot_font = find_font(foot_size, bold=False)
    d.text((text_x, int(sh * 0.68)),
           "SOLANA 2026 FRONTIER HACKATHON  ·  PHYSICAL WORLD APPLICATIONS",
           font=foot_font, fill=CREAM_DIM, anchor="lm")

    # Thin gold horizon line below the text — agricultural touch, not too on-the-nose
    line_y = int(sh * 0.78)
    line_w = max(2, int(sh * 0.005))
    d.line([(text_x, line_y), (text_x + int(sh * 0.6), line_y)],
           fill=(*GOLD, 100), width=line_w)

    return img.resize((width, height), Image.LANCZOS)


if __name__ == "__main__":
    targets = [
        ("banner-3x1.png", 1500, 500),
        ("banner-4x1.png", 1600, 400),
    ]
    for name, w, h in targets:
        out_path = os.path.join(OUT_DIR, name)
        render_banner(w, h).save(out_path, optimize=True)
        print(f"  wrote {out_path} ({w}x{h})")
