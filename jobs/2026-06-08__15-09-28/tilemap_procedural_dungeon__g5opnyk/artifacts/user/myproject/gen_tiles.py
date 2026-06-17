#!/usr/bin/env python3
"""Generate a 48x16 dungeon tile PNG: three 16x16 solid-colour cells.
   Cell 0 (floor)  – green-ish  #6aaa5a
   Cell 1 (wall)   – slate grey #5a5a7a
   Cell 2 (door)   – warm brown #9a6a3a
Also writes each cell as a standalone 16x16 PNG for atlas sources.
"""
import struct, zlib, os

def _u32be(n):
    return struct.pack(">I", n)

def _chunk(tag, data):
    c = zlib.crc32(tag + data) & 0xFFFFFFFF
    return _u32be(len(data)) + tag + data + _u32be(c)

def make_png(width, height, pixels_rgba):
    """pixels_rgba: list of (r,g,b,a) tuples, row-major."""
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr_data = _u32be(width) + _u32be(height) + bytes([8, 6, 0, 0, 0])
    ihdr = _chunk(b"IHDR", ihdr_data)
    raw = b""
    for row in range(height):
        raw += b"\x00"  # filter type None
        for col in range(width):
            r, g, b, a = pixels_rgba[row * width + col]
            raw += bytes([r, g, b, a])
    idat = _chunk(b"IDAT", zlib.compress(raw, 9))
    iend = _chunk(b"IEND", b"")
    return sig + ihdr + idat + iend

COLOURS = [
    (0x6a, 0xaa, 0x5a, 0xff),  # floor – green
    (0x5a, 0x5a, 0x7a, 0xff),  # wall  – slate
    (0x9a, 0x6a, 0x3a, 0xff),  # door  – brown
]
NAMES = ["floor", "wall", "door"]

os.makedirs("tilesets", exist_ok=True)

# Standalone 16x16 PNGs
for i, (colour, name) in enumerate(zip(COLOURS, NAMES)):
    pixels = [colour] * (16 * 16)
    path = f"tilesets/{name}.png"
    with open(path, "wb") as f:
        f.write(make_png(16, 16, pixels))
    print(f"Written {path}")

# Combined 48x16 sprite-sheet (kept as reference)
pixels_sheet = []
for row in range(16):
    for cell in range(3):
        pixels_sheet += [COLOURS[cell]] * 16
path_sheet = "tilesets/dungeon_tiles.png"
with open(path_sheet, "wb") as f:
    f.write(make_png(48, 16, pixels_sheet))
print(f"Written {path_sheet}")
