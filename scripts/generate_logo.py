#!/usr/bin/env python3
"""One-shot generator for Mazra'at albaan / Vuna logo concepts.

Calls Imagen 4 via the Google Generative Language API (same endpoint as
scripts/generate_sidebar_art.py) and writes square PNGs into design/.
Generates several variants per run so we can compare and pick the strongest.

Usage:
    GEMINI_API_KEY=... python scripts/generate_logo.py

The API key is read from the environment so it never lands in git.
Generated files are checked in to design/ once a variant is picked.
"""

import base64
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

MODEL = "imagen-4.0-generate-001"
ENDPOINT = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:predict"
)

OUT_DIR = Path(__file__).resolve().parents[1] / "design"

# Common constraints applied to every prompt — keeps the brand consistent
# and prevents the model wandering off into stock-photo territory.
COMMON = (
    " Highly detailed professional logo design. Square 1:1 composition, "
    "subject centered, generous margin. Earthy South African palette: "
    "forest green, burnt sienna, golden ochre, cream, deep burgundy. "
    "No watermarks, no signatures, no extra random text — only the "
    "labelled text specified. No leaping springbok, no national flag, "
    "no copyrighted symbols."
)

JOBS = [
    {
        "name": "logo-gen-wood-badge.png",
        "prompt": (
            "A premium agricultural brand logo carved into an aged wooden "
            "plaque, badge-shaped with a gently curved top. Deep relief "
            "wood-engraving with rich warm tones and subtle grain texture. "
            "The badge frames a central scene: dawn light over the "
            "Drakensberg mountains, a small clay rondavel hut beside a "
            "maize field in the foreground, golden sun cresting behind "
            "the peaks. Two king protea flower sprigs with sage leaves "
            "frame the sides. A curved banner ribbon at the bottom reads "
            "the words MAZRA'AT ALBAAN in clear serif capitals. Soft "
            "morning light, museum-quality detail, cinematic warmth."
            + COMMON
        ),
    },
    {
        "name": "logo-gen-botanical-emblem.png",
        "prompt": (
            "A vintage botanical-illustration logo emblem rendered in the "
            "style of an antique field-guide plate. A single large king "
            "protea flower head viewed from the front, surrounded by a "
            "circular wreath of acacia leaves and grain stalks. Below the "
            "flower, a curved banner ribbon reads the words "
            "MAZRA'AT ALBAAN in classic serif lettering, with a smaller "
            "tagline VUNA HARVEST. Deep ink-pen lines, hand-engraved "
            "feel, cream parchment background, burgundy protea, "
            "forest-green leaves, warm gold highlights. Heritage "
            "agricultural brand aesthetic." + COMMON
        ),
    },
    {
        "name": "logo-gen-dawn-medallion.png",
        "prompt": (
            "A premium hand-engraved circular emblem logo with a rich "
            "aged-bronze metallic finish. The emblem depicts a stylized "
            "sunrise over the flat-topped Drakensberg mountains, with a "
            "single acacia tree silhouette in the foreground and a "
            "thatched rondavel hut. Around the outer ring of the emblem: "
            "an engraved wreath of protea flowers and grain stalks. A "
            "curved bottom band reads the words MAZRA'AT ALBAAN in "
            "raised serif lettering. Warm golden-hour lighting, rich "
            "metallic finish, fine engraving detail, professional brand "
            "asset." + COMMON
        ),
    },
    {
        "name": "logo-gen-photo-wooden-sign.png",
        "prompt": (
            "Photorealistic close-up product photograph of a hand-carved "
            "wooden farm-sign hanging in a South African vineyard at "
            "golden hour. The wooden sign is rectangular with rounded "
            "corners, weathered oak with deep wood grain visible, "
            "professionally engraved with: a central inset scene of "
            "Drakensberg mountains, a thatched rondavel, and a maize "
            "field at sunrise; flanked by two carved king protea flower "
            "sprays; a banner across the bottom carved with the words "
            "MAZRA'AT ALBAAN in clean serif capitals. Shallow depth of "
            "field, warm sunset light, professional studio-quality "
            "photography, cinematic. The wooden sign fills the frame."
            + COMMON
        ),
    },
]


def call_api(api_key: str, prompt: str) -> bytes:
    body = json.dumps(
        {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": "1:1",
                "personGeneration": "DONT_ALLOW",
            },
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{ENDPOINT}?key={api_key}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        payload = json.load(resp)
    preds = payload.get("predictions") or []
    if not preds:
        raise RuntimeError(f"no predictions in response: {payload}")
    b64 = preds[0].get("bytesBase64Encoded")
    if not b64:
        raise RuntimeError(f"no bytesBase64Encoded in prediction: {preds[0]}")
    return base64.b64decode(b64)


def main() -> int:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("error: GEMINI_API_KEY env var not set", file=sys.stderr)
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for job in JOBS:
        out = OUT_DIR / job["name"]
        if out.exists():
            print(f"skip {job['name']} (already exists)", flush=True)
            continue
        print(f"generating {job['name']}…", flush=True)
        try:
            data = call_api(api_key, job["prompt"])
        except RuntimeError as e:
            print(f"  FAILED: {e}", flush=True)
            continue

        # Imagen returns JPEG bytes. Convert to PNG so we have a lossless
        # source for any later compositing / palette extraction.
        with tempfile.NamedTemporaryFile(
            suffix=".jpg", delete=False
        ) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_path, str(out)],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            print(
                f"  wrote {out}  ({out.stat().st_size // 1024} KB)",
                flush=True,
            )
        finally:
            os.unlink(tmp_path)

    print("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
