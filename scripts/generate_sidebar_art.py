#!/usr/bin/env python3
"""One-shot generator for the dashboard sidebar background images.

Calls Imagen 4 via the Google Generative Language API and writes JPEGs to
app/public/media/. The output files are checked in to the repo, so this
script should only be re-run when we want different art.

Usage:
    GEMINI_API_KEY=... python scripts/generate_sidebar_art.py

The API key is read from the environment so it never lands in git.
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

OUT_DIR = Path(__file__).resolve().parents[1] / "app" / "public" / "media"

WEBP_QUALITY = "82"  # passed to ffmpeg's libwebp; 80-85 is the sweet spot

JOBS = [
    {
        "name": "sidebar-left.webp",
        "prompt": (
            "Cinematic portrait photograph of a South African smallholder "
            "farmer standing among rows of maize at golden hour, warm amber "
            "and coral sunset light, soft painterly atmosphere, dignified "
            "expression, weathered hands resting on a maize stalk, soft "
            "shallow depth of field, mood is hopeful and grounded. Vertical "
            "9:16 framing with darker tones at the bottom suitable as a UI "
            "background. Subtle film grain, no text, no logos."
        ),
    },
    {
        "name": "sidebar-right.webp",
        "prompt": (
            "Cinematic vertical photograph of an African farmer woman "
            "walking through a wheat field at sunrise, golden side light, "
            "soft bokeh, dust motes in the air, dark warm sky overhead "
            "fading to warm coral and amber on the horizon, painterly "
            "atmosphere, peaceful, hopeful. Vertical 9:16 framing with "
            "darker tones at the top suitable as a UI background. Subtle "
            "film grain, no text, no logos."
        ),
    },
]


def call_api(api_key: str, prompt: str) -> bytes:
    body = json.dumps(
        {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": "9:16",
                "personGeneration": "ALLOW_ADULT",
            },
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{ENDPOINT}?key={api_key}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
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
        print(f"generating {job['name']}…", flush=True)
        data = call_api(api_key, job["prompt"])

        # Imagen returns PNG/JPEG bytes. Convert to WebP via ffmpeg so the
        # served file is ~10x smaller than the raw API output.
        with tempfile.NamedTemporaryFile(
            suffix=".jpg", delete=False
        ) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            out = OUT_DIR / job["name"]
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    tmp_path,
                    "-c:v",
                    "libwebp",
                    "-quality",
                    WEBP_QUALITY,
                    "-compression_level",
                    "6",
                    str(out),
                ],
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
