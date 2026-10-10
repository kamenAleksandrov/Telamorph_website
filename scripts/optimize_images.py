#!/usr/bin/env python3
"""Make web-sized WebP copies of the site's raster images.

The full-size JPEG/PNG files in ``assets/images/`` are the masters and are never
modified. This script writes a WebP copy of each one into ``build-cache/images/``,
downscaled so its long edge is at most ``MAX_EDGE`` pixels. ``build_site.py``
imports it and publishes those copies to ``dist/``; run it directly to see what
the conversion saves:

    python scripts/optimize_images.py          # summary + per-page numbers
    python scripts/optimize_images.py --all    # also list every image

Converted files are cached by source size, modification time and settings, so
only new or changed images are re-encoded.
"""

from __future__ import annotations

import argparse
import json
import re
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict, dataclass
from pathlib import Path

try:
    from PIL import Image, ImageOps, features
except ImportError:  # pragma: no cover - reported to the user by require_pillow()
    Image = None


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "images"
CACHE = ROOT / "build-cache" / "images"
MANIFEST = CACHE / "manifest.json"

# The widest any image is shown is a full-width hero on a 1080p screen. Larger
# images only cost GPU memory (4 bytes per pixel once decoded), and running out
# of it is what makes scrolled tiles blink black on phones and laptops.
MAX_EDGE = 1920
# Photos hide WebP's smoothing; renders and graphics (PNG sources) show it on
# fine textures such as brushed metal, so they get a higher quality.
PHOTO_QUALITY = 82
GRAPHIC_QUALITY = 90
SETTINGS = f"edge={MAX_EDGE};q={PHOTO_QUALITY}/{GRAPHIC_QUALITY};v1"
RASTER_SUFFIXES = {".jpg", ".jpeg", ".png"}

PAGES = (
    "index.html",
    "about.html",
    "composite-development.html",
    "manufacturing.html",
    "industrial.html",
    "contact.html",
    "resellers.html",
    "404.html",
)
# Page-rendered references only; absolute https://telamorph.com/... URLs are
# share/SEO metadata and keep pointing at the original files.
PAGE_IMAGE_PATTERN = re.compile(
    r"(?<!telamorph\.com/)assets/images/([\w./-]+?\.(?:jpe?g|png))\b", re.IGNORECASE
)


@dataclass
class Result:
    source: str  # posix path relative to assets/images
    webp: str | None  # posix path relative to assets/images, None if kept as-is
    source_bytes: int
    source_size: tuple[int, int]
    webp_bytes: int
    webp_size: tuple[int, int]
    note: str = ""


def require_pillow() -> None:
    if Image is None:
        raise SystemExit(
            "Pillow is required to build the WebP images.\n"
            "Install it with:  python -m pip install -r requirements.txt"
        )
    if not features.check("webp"):
        raise SystemExit("This Pillow build has no WebP support; reinstall Pillow.")


def source_images() -> list[Path]:
    return sorted(
        path
        for path in SOURCE.rglob("*")
        if path.is_file() and path.suffix.lower() in RASTER_SUFFIXES
    )


def _prepare(image: "Image.Image") -> "Image.Image":
    has_alpha = image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    )
    image = image.convert("RGBA" if has_alpha else "RGB")
    if max(image.size) > MAX_EDGE:
        image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
    return image


def convert_one(source_path: str) -> dict:
    """Encode one image into the cache. Runs in a worker process."""
    source = Path(source_path)
    rel = source.relative_to(SOURCE)
    target = (CACHE / rel).with_suffix(".webp")
    target.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as original:
        icc_profile = original.info.get("icc_profile")
        # Phone photos store rotation in EXIF; WebP output drops EXIF, so bake it in.
        upright = ImageOps.exif_transpose(original)
        source_size = upright.size
        image = _prepare(upright)
    quality = GRAPHIC_QUALITY if source.suffix.lower() == ".png" else PHOTO_QUALITY
    save_options = {"quality": quality, "method": 4}
    if icc_profile:
        save_options["icc_profile"] = icc_profile
    image.save(target, "WEBP", **save_options)

    source_bytes = source.stat().st_size
    webp_bytes = target.stat().st_size
    resized = image.size != source_size
    webp = rel.with_suffix(".webp").as_posix()
    note = ""
    if webp_bytes >= source_bytes and not resized:
        # Already small and not oversized: WebP would only make it bigger.
        target.unlink()
        webp, webp_bytes, note = None, source_bytes, "kept original (WebP was larger)"
    return asdict(
        Result(
            source=rel.as_posix(),
            webp=webp,
            source_bytes=source_bytes,
            source_size=source_size,
            webp_bytes=webp_bytes,
            webp_size=image.size,
            note=note,
        )
    )


def _fingerprint(path: Path) -> str:
    stat = path.stat()
    return f"{stat.st_size}:{stat.st_mtime_ns}:{SETTINGS}"


def optimize() -> list[Result]:
    """Bring the WebP cache up to date and return one result per source image."""
    require_pillow()
    try:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        manifest = {}

    sources = source_images()
    results: dict[str, dict] = {}
    stale: list[Path] = []
    for source in sources:
        rel = source.relative_to(SOURCE).as_posix()
        entry = manifest.get(rel)
        cached_ok = (
            entry
            and entry.get("fingerprint") == _fingerprint(source)
            and (entry["result"]["webp"] is None or (CACHE / entry["result"]["webp"]).is_file())
        )
        if cached_ok:
            results[rel] = entry["result"]
        else:
            stale.append(source)

    if stale:
        print(f"Encoding {len(stale)} image(s) to WebP...")
        with ProcessPoolExecutor() as pool:
            for source, result in zip(stale, pool.map(convert_one, map(str, stale))):
                results[result["source"]] = result
                manifest[result["source"]] = {
                    "fingerprint": _fingerprint(source),
                    "result": result,
                }

    live = {source.relative_to(SOURCE).as_posix() for source in sources}
    manifest = {rel: entry for rel, entry in manifest.items() if rel in live}
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True), encoding="utf-8")

    return [
        Result(**{**r, "source_size": tuple(r["source_size"]), "webp_size": tuple(r["webp_size"])})
        for _, r in sorted(results.items())
    ]


# --- Report -------------------------------------------------------------------

def _mb(value: float) -> str:
    if value < 1_000_000:
        return f"{value / 1000:,.0f} KB"
    return f"{value / 1_000_000:,.1f} MB"


def _decoded(size: tuple[int, int]) -> int:
    # Browsers decode to 4 bytes per pixel; this is what sits in GPU memory.
    return size[0] * size[1] * 4


def page_references() -> dict[str, set[str]]:
    pages: dict[str, set[str]] = {}
    for name in PAGES:
        path = ROOT / name
        if path.is_file():
            text = path.read_text(encoding="utf-8")
            pages[name] = {m.group(1) for m in PAGE_IMAGE_PATTERN.finditer(text)}
    products = json.loads((ROOT / "data" / "products.json").read_text(encoding="utf-8"))
    pages.setdefault("industrial.html", set()).update(
        str(product["thumbnail"]) for product in products
    )
    return pages


def report(results: list[Result], show_all: bool) -> None:
    by_source = {result.source: result for result in results}
    converted = [r for r in results if r.webp]

    rows = sorted(results, key=lambda r: r.source_bytes - r.webp_bytes, reverse=True)
    if not show_all:
        rows = rows[:15]
    print(f"\n{'Image':<58}{'Original':>22}   {'WebP'}")
    for r in rows:
        before = f"{r.source_size[0]}x{r.source_size[1]} {_mb(r.source_bytes)}"
        after = f"{r.webp_size[0]}x{r.webp_size[1]} {_mb(r.webp_bytes)}" if r.webp else r.note
        print(f"{r.source:<58}{before:>22}   {after}")
    if not show_all and len(results) > len(rows):
        print(f"... {len(results) - len(rows)} more (use --all to list them)")

    src_bytes = sum(r.source_bytes for r in results)
    web_bytes = sum(r.webp_bytes for r in results)
    src_mem = sum(_decoded(r.source_size) for r in results)
    web_mem = sum(_decoded(r.webp_size) for r in results)
    print(
        f"\n{len(results)} images, {len(converted)} converted"
        f"\n  Download size:     {_mb(src_bytes)} -> {_mb(web_bytes)}"
        f"  ({100 * (1 - web_bytes / src_bytes):.0f}% smaller)"
        f"\n  Decoded GPU memory: {_mb(src_mem)} -> {_mb(web_mem)}"
        f"  ({100 * (1 - web_mem / src_mem):.0f}% smaller)"
    )

    print(f"\n{'Page':<30}{'Download':>24}{'Decoded image memory':>28}")
    for page, refs in page_references().items():
        found = [by_source[ref] for ref in refs if ref in by_source]
        if not found:
            continue
        dl = f"{_mb(sum(r.source_bytes for r in found))} -> {_mb(sum(r.webp_bytes for r in found))}"
        mem = (
            f"{_mb(sum(_decoded(r.source_size) for r in found))} -> "
            f"{_mb(sum(_decoded(r.webp_size) for r in found))}"
        )
        print(f"{page:<30}{dl:>24}{mem:>28}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--all", action="store_true", help="list every image")
    args = parser.parse_args()
    report(optimize(), args.all)


if __name__ == "__main__":
    main()
