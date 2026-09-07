"""Derive every brand asset from the one master render.

    python scripts/build-brand.py        # writes public/brand/* and public/favicon-*.png
    python scripts/build-brand.py --check # fails if a checked-in asset is stale

The master is brand/basis-logo-master.png — the supplied logo, byte-for-byte, never edited.
Everything the interface uses is cut from it here, so there is exactly one place where the
brand exists and no hand-edited copy that can quietly stop matching it. The outputs are
checked in, so nobody needs Python to build or deploy; this script is only needed when the
master changes.

Requires Pillow (pip install Pillow). That is the same arrangement as
scripts/capture-ground-truth.py: a Python tool that regenerates checked-in data, not part of
the app's build.

Three things are done to the master, and all three are removals rather than changes. Nothing
is redrawn, recoloured beyond the one case below, restretched or filtered.

1. THE CONTACT SHADOW IS DROPPED from the mark.

   The master renders the cluster floating above a soft grey ellipse. On parchment that reads
   as a grounding shadow; on the off-black surface the interface uses in dark mode it is a
   pale smudge under the logo, which is worse than no shadow at all. The shadow is separable
   because it is nothing but low alpha — the blocks sit at 251-253, the shadow below 60 — so
   ALPHA_FLOOR cuts it off without touching the art. Measured: at 210 the shadow is gone on
   off-black and the block edges are still smooth. Below 180 a smudge survives.

2. THE TAGLINE IS NOT PART OF THE UI LOCKUP.

   "GENERATE / REFINE / SHIP" sits at 29px in a 724px-wide master. At the 32px navbar height
   the whole lockup is 83px wide and that row would be a third of a pixel tall. §2 defines
   `full` as mark plus wordmark, which is what the interface gets. The complete lockup is not
   emitted at all: nothing in the app renders it, and a 550 kB copy of the master sitting in
   public/ to be deployed and never requested is the duplicate asset §17 warns about. The
   master itself is in the repo at brand/ for anyone who needs the tagline version.

3. THE WORDMARK GETS A LIGHT TREATMENT for dark surfaces.

   The master's wordmark is a flat #242426 with no gradient, so swapping RGB while keeping
   every alpha value is a recolour of one solid colour and nothing else — the letterforms,
   spacing and anti-aliasing are the master's. Without it the word is invisible in dark mode:
   #242426 on #242424 is 1.00:1. This is the "if no light version exists" case §23 describes.

The mark itself is never recoloured for either theme. It is the same object on parchment and
on off-black, which is what makes it an identity rather than a decoration.
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover - a setup problem, not a code path
    sys.exit("Pillow is required: pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "brand" / "basis-logo-master.png"
OUT = ROOT / "public" / "brand"
PUBLIC = ROOT / "public"

# Where each element sits in the master. Measured from its alpha channel, not eyeballed:
# the mark and the right-hand group are separated by a 35px column of nothing at x 875-910,
# and inside that group the wordmark and the tagline row are separated by 31 empty rows.
MARK_BAND = (400, 900)
TEXT_BAND = (900, 1700)
WORDMARK_ROWS = (219, 462)
TAGLINE_ROWS = (493, 522)

# See note 1. The block edges keep a smooth ramp above this; the shadow is entirely below it.
ALPHA_FLOOR = 210
# The wordmark has no shadow to remove, so it keeps its anti-aliasing almost untouched.
TEXT_ALPHA_FLOOR = 24

PARCHMENT = (246, 243, 241, 255)
LIGHT_INK = (246, 243, 241)

# Output heights. Every one is at least 3x the largest size the interface renders it at, so
# the browser only ever downscales — a logo that has been upscaled looks soft in exactly the
# place people look hardest.
MARK_H = 256
WORDMARK_H = 128
FAVICON_SIZES = (32, 180)
# How much of the favicon square the mark fills.
#
# Chosen at 16px, not at 512: the cluster is ten blocks, and small is where it either survives
# or turns to mush. Rendered at 16 and magnified, 0.74 wastes a third of the tab icon on
# margin and 0.94 puts the top block against the corner radius. 0.88 fills the square and
# still reads as an icon rather than a cropped photograph.
FAVICON_INSET = 0.88
# Corner radius as a fraction of the icon's edge, matching the interface's own 10px-on-44px.
FAVICON_RADIUS = 0.22


def floor_alpha(img: Image.Image, k: int) -> Image.Image:
    """Drop everything under `k` and rescale what is left back to a full 0-255 ramp."""
    r, g, b, a = img.split()
    a = a.point(lambda v: 0 if v < k else min(255, round((v - k) * 255 / (255 - k))))
    return Image.merge("RGBA", (r, g, b, a))


def trim(img: Image.Image) -> Image.Image:
    """Crop to the drawn pixels. Padding is the caller's business, never the asset's."""
    box = img.split()[3].point(lambda v: 255 if v > 8 else 0).getbbox()
    return img.crop(box)


def scale_to_height(img: Image.Image, height: int) -> Image.Image:
    width = max(1, round(img.width * height / img.height))
    return img.resize((width, height), Image.LANCZOS)


def recolour(img: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    """Replace RGB, keep every alpha value. Only valid on flat, single-colour art."""
    solid = Image.new("RGBA", img.size, rgb + (255,))
    solid.putalpha(img.split()[3])
    return solid


def build() -> dict[str, Image.Image]:
    master = Image.open(MASTER).convert("RGBA")

    mark = trim(floor_alpha(master.crop((MARK_BAND[0], 0, MARK_BAND[1], master.height)), ALPHA_FLOOR))
    word = trim(
        floor_alpha(
            master.crop((TEXT_BAND[0], WORDMARK_ROWS[0], TEXT_BAND[1], WORDMARK_ROWS[1])),
            TEXT_ALPHA_FLOOR,
        )
    )

    assets: dict[str, Image.Image] = {
        "brand/basis-mark.png": scale_to_height(mark, MARK_H),
        "brand/basis-wordmark.png": scale_to_height(word, WORDMARK_H),
        "brand/basis-wordmark-light.png": scale_to_height(recolour(word, LIGHT_INK), WORDMARK_H),
    }

    """
    The favicon is the mark on a parchment ground, and the ground is doing real work.

    A tab strip is the one surface the mark cannot choose: Chrome's is near-white, Safari's in
    dark mode is near-black, and the cluster contains both a cream cube and a near-black one.
    On white the cream cube dissolves; on black the dark cube does. Parchment behind it is the
    same surface the mark sits on everywhere else in the product, so the icon is the logo in
    its own context rather than a cut-out that loses a block depending on the browser.
    """
    # 32 for the tab, 180 for an iOS home screen. The 192 and 512 sizes a manifest would want
    # are not emitted: Basis has no web app manifest, and §19's app icon is conditional on
    # being a PWA. Files nothing links to are dead weight in the deploy.
    for size in FAVICON_SIZES:
        icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        radius = round(size * FAVICON_RADIUS)
        ImageDraw.Draw(icon).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=PARCHMENT)
        inner = size * FAVICON_INSET
        scaled = mark.copy()
        ratio = min(inner / scaled.width, inner / scaled.height)
        scaled = scaled.resize((max(1, round(scaled.width * ratio)), max(1, round(scaled.height * ratio))), Image.LANCZOS)
        icon.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
        assets[f"favicon-{size}.png"] = icon

    return assets


def main() -> None:
    check = "--check" in sys.argv
    assets = build()
    OUT.mkdir(parents=True, exist_ok=True)

    stale: list[str] = []
    for name, img in assets.items():
        path = PUBLIC / name
        data = _png_bytes(img)
        if check:
            if not path.exists() or path.read_bytes() != data:
                stale.append(name)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            print(f"  {name}  {img.width}x{img.height}  {len(data) / 1024:.1f} kB")

    if check:
        if stale:
            sys.exit("stale brand assets, re-run scripts/build-brand.py:\n  " + "\n  ".join(stale))
        print(f"{len(assets)} brand assets up to date")
    else:
        print(f"wrote {len(assets)} assets from {MASTER.relative_to(ROOT)}")


def _png_bytes(img: Image.Image) -> bytes:
    import io

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


if __name__ == "__main__":
    main()
