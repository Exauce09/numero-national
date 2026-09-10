"""Remove photographic / checkerboard backgrounds from RDC card assets."""

from __future__ import annotations

import collections
from pathlib import Path

from PIL import Image

BASE = Path(__file__).resolve().parents[1] / "frontends" / "onip-dashboard" / "public" / "card-assets"
# Prefer original copies from Cursor assets if present
ORIG = Path(
    r"C:\Users\hp\.cursor\projects\c-Users-hp-Documents-NUMERO-NATIONAL\assets"
)


def flood_transparent(img: Image.Image, seeds: list[tuple[int, int]], tol: int = 35) -> Image.Image:
    w, h = img.size
    px = img.load()
    visited = [[False] * h for _ in range(w)]
    q: collections.deque[tuple[int, int]] = collections.deque()
    for sx, sy in seeds:
        if 0 <= sx < w and 0 <= sy < h:
            q.append((sx, sy))
            visited[sx][sy] = True
    while q:
        x, y = q.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                nr, ng, nb, na = px[nx, ny]
                if na == 0:
                    visited[nx][ny] = True
                    continue
                if abs(nr - r) + abs(ng - g) + abs(nb - b) <= tol * 3:
                    visited[nx][ny] = True
                    q.append((nx, ny))
    return img


def crop_alpha(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def remove_checker_and_gray_bg(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx - mn < 30 and 60 <= mx <= 250:
                px[x, y] = (r, g, b, 0)
                continue
            if r > 228 and g > 228 and b > 228:
                px[x, y] = (r, g, b, 0)
                continue
            # faint Alamy watermark gray text
            if mx - mn < 18 and 140 <= mx <= 210 and y < int(h * 0.35):
                px[x, y] = (r, g, b, 0)
    seeds = [
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (0, h // 2),
        (w - 1, h // 2),
        (w // 2, h - 1),
    ]
    im = flood_transparent(im, seeds, tol=30)
    # drop leftover black title text in top-left (not part of emblem)
    px = im.load()
    for y in range(min(h, 40)):
        for x in range(min(w, int(w * 0.55))):
            r, g, b, a = px[x, y]
            if a and r < 40 and g < 40 and b < 40:
                px[x, y] = (0, 0, 0, 0)
    im = crop_alpha(im)
    im.save(dest, "PNG")
    print("armoiries", dest.name, im.size)


def remove_sky_bg(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if b > 115 and b >= g - 5 and b > r + 10 and (b - min(r, g)) > 20:
                px[x, y] = (r, g, b, 0)
                continue
            if r > 195 and g > 195 and b > 195 and abs(r - g) < 22 and abs(g - b) < 22:
                if y < int(h * 0.58):
                    px[x, y] = (r, g, b, 0)
                    continue
            if g > r + 18 and g > b + 8 and g > 70 and r < 145:
                if int(h * 0.4) < y < int(h * 0.8):
                    px[x, y] = (r, g, b, 0)
    seeds = [(0, 0), (w - 1, 0), (w // 2, 0), (0, 2), (w - 1, 2), (1, 0)]
    im = flood_transparent(im, seeds, tol=42)
    # clear asphalt / road from bottom corners (keep tower)
    px = im.load()
    for y in range(int(h * 0.72), h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a:
                continue
            if max(r, g, b) < 90:  # dark asphalt
                px[x, y] = (r, g, b, 0)
            elif abs(r - g) < 25 and abs(g - b) < 25 and 40 < r < 120:
                px[x, y] = (r, g, b, 0)
    # yellow railings near edges bottom — remove as background clutter
    for y in range(int(h * 0.55), h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a:
                continue
            if r > 150 and g > 120 and b < 90 and r > b + 40:
                if x < int(w * 0.22) or x > int(w * 0.78):
                    px[x, y] = (r, g, b, 0)
    im = crop_alpha(im)
    im.save(dest, "PNG")
    print("tour", dest.name, im.size)


def remove_green_bg(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if g > 65 and g >= r - 5 and g >= b and (g - min(r, b)) > 12:
                # keep okapi reddish-brown: r often > g
                if r > g + 15 and r > 90:
                    continue
                px[x, y] = (r, g, b, 0)
                continue
            if g > 100 and r < 170 and b < 120 and g > b + 20:
                if not (r > g + 10):
                    px[x, y] = (r, g, b, 0)
    seeds = [
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (0, h // 2),
        (w - 1, h // 2),
        (w // 2, h - 1),
        (w // 4, 0),
        (3 * w // 4, 0),
    ]
    im = flood_transparent(im, seeds, tol=48)
    im = crop_alpha(im)
    im.save(dest, "PNG")
    print("okapi", dest.name, im.size)


def resolve_src(name: str, fallback_glob: str) -> Path:
    dest = BASE / name
    # always re-copy from original asset if available
    matches = list(ORIG.glob(fallback_glob))
    if matches:
        return matches[0]
    return dest


def main() -> None:
    BASE.mkdir(parents=True, exist_ok=True)
    arms_src = resolve_src("armoiries-rdc.png", "*armoirie*")
    tour_src = resolve_src("tour-echangeur.png", "*ech*")
    okapi_src = resolve_src("okapi.png", "*OIP__1*")
    print("sources:", arms_src, tour_src, okapi_src)
    remove_checker_and_gray_bg(arms_src, BASE / "armoiries-rdc.png")
    remove_sky_bg(tour_src, BASE / "tour-echangeur.png")
    remove_green_bg(okapi_src, BASE / "okapi.png")
    print("done")


if __name__ == "__main__":
    main()
