#!/usr/bin/env python3
"""Write KEY yellow/black PNG + ICO for the Windows client. No extra deps."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "build"
YELLOW = (255, 233, 0, 255)
INK = (17, 17, 17, 255)


def png_chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, rgba: list[list[tuple[int, int, int, int]]]) -> None:
    h = len(rgba)
    w = len(rgba[0])
    raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in rgba)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )


def rounded_key(size: int) -> list[list[tuple[int, int, int, int]]]:
    img = [[(0, 0, 0, 0) for _ in range(size)] for _ in range(size)]
    r = max(4, size // 7)
    for y in range(size):
        for x in range(size):
            dx = min(x, size - 1 - x)
            dy = min(y, size - 1 - y)
            if dx < r and dy < r and (dx - r) ** 2 + (dy - r) ** 2 > r * r:
                continue
            img[y][x] = INK
    # yellow braces
    t = max(2, size // 16)
    inset = size // 6
    for y in range(inset, size - inset):
        for x in range(inset, inset + t):
            img[y][x] = YELLOW
        for x in range(size - inset - t, size - inset):
            img[y][x] = YELLOW
    for x in range(inset, inset + t + size // 10):
        for y in range(inset, inset + t):
            img[y][x] = YELLOW
        for y in range(size - inset - t, size - inset):
            img[y][x] = YELLOW
    for x in range(size - inset - t - size // 10, size - inset):
        for y in range(inset, inset + t):
            img[y][x] = YELLOW
        for y in range(size - inset - t, size - inset):
            img[y][x] = YELLOW
    # KEY bar
    bar_l = size // 3
    bar_r = size - size // 3
    bar_t = size // 2 - t
    bar_b = size // 2 + t
    for y in range(bar_t, bar_b):
        for x in range(bar_l, bar_r):
            img[y][x] = YELLOW
    return img


def ico_from_pngs(path: Path, pngs: list[bytes]) -> None:
    count = len(pngs)
    offset = 6 + 16 * count
    entries = []
    blobs = []
    for blob in pngs:
        # PNG IHDR width/height
        w = blob[16:20]
        h = blob[20:24]
        width = int.from_bytes(w, "big")
        height = int.from_bytes(h, "big")
        entries.append((width if width < 256 else 0, height if height < 256 else 0, len(blob), offset))
        blobs.append(blob)
        offset += len(blob)
    out = bytearray(struct.pack("<HHH", 0, 1, count))
    for width, height, size, off in entries:
        out += struct.pack("<BBBBHHII", width, height, 0, 0, 1, 32, size, off)
    for blob in blobs:
        out += blob
    path.write_bytes(out)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    png_bytes = []
    for size in (16, 32, 48, 64, 128, 256):
        p = OUT / f"icon-{size}.png"
        write_png(p, rounded_key(size))
        png_bytes.append(p.read_bytes())
    write_png(OUT / "icon.png", rounded_key(256))
    ico_from_pngs(OUT / "icon.ico", png_bytes)
    print("wrote", OUT / "icon.ico")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
