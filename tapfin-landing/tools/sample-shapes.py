"""Samples the supplied particle artworks into point clouds for the WebGL field.

Each output is a little-endian Int16 array of (x, y, brightness) triplets:
x and y in -10000..10000 (aspect kept, y up), brightness 0..10000.
Run: python3 tools/sample-shapes.py
"""
import random
import struct
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
COUNT = 9000
SOURCES = {
    "database": "assets/img/database.jpg",
    "rupee": "assets/img/rupee.jpg",
    "xchange": "assets/img/xchange.jpg",
    "shield": "assets/img/shield.jpg",
}


def sample(path, count, threshold=70):
    im = Image.open(ROOT / path).convert("L")
    im.thumbnail((520, 520))
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    w, h = im.size
    px = im.load()
    cells = [(x, y, px[x, y]) for y in range(h) for x in range(w) if px[x, y] > threshold]
    # percentile bounds, so stray specks of dust don't shrink the shape
    xs = sorted(c[0] for c in cells)
    ys = sorted(c[1] for c in cells)
    lo, hi = len(cells) // 100, len(cells) - 1 - len(cells) // 100
    x0, x1, y0, y1 = xs[lo], xs[hi], ys[lo], ys[hi]
    cx, cy, half = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) / 2
    weights = [(v - threshold) ** 1.4 for _, _, v in cells]
    rng = random.Random(7)
    picks = rng.choices(cells, weights=weights, k=count)
    out = bytearray()
    for x, y, v in picks:
        jx, jy = rng.random() - 0.5, rng.random() - 0.5
        nx = (x + jx - cx) / half
        ny = -(y + jy - cy) / half
        out += struct.pack("<hhh", int(nx * 10000), int(ny * 10000), int(v / 255 * 10000))
    return out


for name, src in SOURCES.items():
    data = sample(src, COUNT)
    (ROOT / "assets/shapes" / f"{name}.bin").write_bytes(data)
    print(name, len(data), "bytes")
