"""AI cutout (rembg) for card heritage assets — true transparent PNG."""

from __future__ import annotations

from pathlib import Path

from PIL import Image
from rembg import remove

ORIG = Path(r"C:\Users\hp\.cursor\projects\c-Users-hp-Documents-NUMERO-NATIONAL\assets")
DEST = Path(__file__).resolve().parents[1] / "frontends" / "onip-dashboard" / "public" / "card-assets"


def one(src: Path, dest: Path) -> None:
    raw = src.read_bytes()
    out = remove(raw)
    im = Image.open(__import__("io").BytesIO(out)).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "PNG")
    # count opaque pixels
    alpha = im.split()[-1]
    opaque = sum(1 for p in alpha.getdata() if p > 10)
    print(f"{dest.name}: {im.size} opaque≈{opaque}")


def main() -> None:
    mapping = [
        (next(ORIG.glob("*armoirie*")), DEST / "armoiries-rdc.png"),
        (next(ORIG.glob("*ech-*")), DEST / "tour-echangeur.png"),
        (next(ORIG.glob("*OIP__1*")), DEST / "okapi.png"),
    ]
    for src, dest in mapping:
        print("processing", src.name, "->", dest.name)
        one(src, dest)
    print("done")


if __name__ == "__main__":
    main()
