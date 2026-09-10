"""Cut out card assets with rembg u2netp (small model) + cleanup."""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

ORIG = Path(r"C:\Users\hp\.cursor\projects\c-Users-hp-Documents-NUMERO-NATIONAL\assets")
DEST = Path(__file__).resolve().parents[1] / "frontends" / "onip-dashboard" / "public" / "card-assets"


def cleanup_near_transparent(im: Image.Image, threshold: int = 20) -> Image.Image:
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < threshold:
                px[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def process(src: Path, dest: Path, session) -> None:
    print("cutout", src.name)
    out = remove(src.read_bytes(), session=session)
    im = Image.open(io.BytesIO(out)).convert("RGBA")
    im = cleanup_near_transparent(im)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "PNG")
    opaque = sum(1 for p in im.split()[-1].getdata() if p > 10)
    print(" ->", dest.name, im.size, "opaque~", opaque)


def main() -> None:
    print("loading u2netp session…")
    session = new_session("u2netp")
    jobs = [
        (next(ORIG.glob("*armoirie*")), DEST / "armoiries-rdc.png"),
        (next(ORIG.glob("*ech-*")), DEST / "tour-echangeur.png"),
        (next(ORIG.glob("*OIP__1*")), DEST / "okapi.png"),
    ]
    for src, dest in jobs:
        process(src, dest, session)
    print("done")


if __name__ == "__main__":
    main()
