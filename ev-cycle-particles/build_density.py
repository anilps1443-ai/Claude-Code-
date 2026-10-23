#!/usr/bin/env python3
"""Embed the particle density map into a version page (vN/index.html).

The page places its dots by importance-sampling the brightness of the
reference artwork inside each traced shape, so the car lines, battery detail
and particle texture land exactly where they sit in reference.jpg. This script
converts the reference to a greyscale WebP and writes it, base64
encoded, into the <script id="density"> block of a version's index.html.

Usage: python3 build_density.py [v2/index.html]   (needs Pillow)
Without an argument it updates the newest version folder (vN/index.html).
"""
import base64
import io
import pathlib
import re
import sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
SIZE = (2000, 1494)  # full artboard: keeps the fine particle texture
QUALITY = 78

img = Image.open(HERE / "reference.jpg").convert("L")
assert img.size == (2000, 1494), f"reference.jpg should be 2000x1494, got {img.size}"
buf = io.BytesIO()
img.resize(SIZE, Image.LANCZOS).save(buf, "WEBP", quality=QUALITY, method=6)
data = base64.b64encode(buf.getvalue()).decode("ascii")

if len(sys.argv) > 1:
    page = pathlib.Path(sys.argv[1]).resolve()
else:
    page = max(HERE.glob("v*/index.html"), key=lambda p: int(p.parent.name[1:]))
html, n = re.subn(
    r'(<script id="density" type="text/plain">)[^<]*(</script>)',
    lambda m: m.group(1) + data + m.group(2),
    page.read_text(encoding="utf-8"),
)
assert n == 1, f"density block not found in {page}"
page.write_text(html, encoding="utf-8")
print(f"density map: {SIZE[0]}x{SIZE[1]} WebP, {len(buf.getvalue()) / 1024:.0f} KB -> {page.relative_to(HERE)}")
