#!/usr/bin/env python3
"""Embed the particle density map into a version page (vN/index.html).

The page places its dots by importance-sampling the brightness of the
reference artwork inside each traced shape, so the bars, bowl and particle
texture land exactly where they sit in reference.webp. This script converts
the reference to a greyscale WebP and writes it, base64 encoded, into the
<script id="density"> block of a version's index.html.

Usage: python3 build_density.py [v1/index.html]   (needs Pillow)
Without an argument it updates the newest version folder (vN/index.html).
"""
import base64
import io
import pathlib
import re
import sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
SIZE = (1451, 1084)  # the full artboard
QUALITY = 80

img = Image.open(HERE / "reference.webp").convert("L")
assert img.size == SIZE, f"reference.webp should be {SIZE[0]}x{SIZE[1]}, got {img.size}"
buf = io.BytesIO()
img.save(buf, "WEBP", quality=QUALITY, method=6)
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
