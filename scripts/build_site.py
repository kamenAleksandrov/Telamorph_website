#!/usr/bin/env python3
"""Build the crawlable Firebase Hosting payload in ``dist/``.

The repository root is the editable source tree. This script is the only place
that assembles deployable files: it embeds the shared navigation/footer, adds a
static product-card fallback to the catalogue, generates one HTML document per
product, and generates the sitemap and llms.txt product index.
"""

from __future__ import annotations

import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse

import optimize_images


ROOT = Path(__file__).resolve().parents[1]
DIST = (ROOT / "dist").resolve()
SITE_URL = "https://telamorph.com"

STATIC_PAGES = (
    "index.html",
    "about.html",
    "case-studies.html",
    "composite-development.html",
    "manufacturing.html",
    "industrial.html",
    "contact.html",
    "resellers.html",
    "404.html",
)

STATIC_SITEMAP_PATHS = (
    "/",
    "/composite-development.html",
    "/manufacturing.html",
    "/industrial.html",
    "/about.html",
    "/case-studies.html",
    "/contact.html",
    "/resellers.html",
)

COPY_DIRECTORIES = ("assets", "components", "data")
STANDALONE_PAGES = ("hmi-web-demo.html",)
PRODUCT_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LOCAL_REFERENCE_PATTERN = re.compile(
    r"(?:href|src)=[\"'](?P<url>[^\"'#]+)[\"']", re.IGNORECASE
)
# Any image reference, including inline-style url(...) and absolute site URLs.
IMAGE_REFERENCE_PATTERN = re.compile(
    r"assets/images/(?P<path>[\w./-]+?\.(?:jpe?g|png|webp|svg|gif))\b", re.IGNORECASE
)
TEXT_SUFFIXES = {".html", ".css", ".js", ".json"}


def escaped(value: object) -> str:
    return html.escape(str(value), quote=True)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8", newline="\n")


def reset_dist() -> None:
    root = ROOT.resolve()
    if DIST.parent != root or DIST.name != "dist":
        raise RuntimeError(f"Refusing to delete unsafe build path: {DIST}")
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()


def load_products() -> list[dict[str, object]]:
    data_path = ROOT / "data" / "products.json"
    products = json.loads(read_text(data_path))
    if not isinstance(products, list) or not products:
        raise ValueError("data/products.json must contain a non-empty array")

    seen_ids: set[str] = set()
    required = {
        "id",
        "name",
        "category",
        "shortDescription",
        "description",
        "highlights",
        "specifications",
        "thumbnail",
    }
    for index, product in enumerate(products, start=1):
        if not isinstance(product, dict):
            raise ValueError(f"Product {index} must be an object")
        missing = sorted(required.difference(product))
        if missing:
            raise ValueError(f"Product {index} is missing: {', '.join(missing)}")

        product_id = str(product["id"])
        if not PRODUCT_ID_PATTERN.fullmatch(product_id):
            raise ValueError(f"Unsafe product id: {product_id!r}")
        if product_id in seen_ids:
            raise ValueError(f"Duplicate product id: {product_id}")
        seen_ids.add(product_id)

        image_paths = list(product.get("images") or [])
        thumbnail = str(product["thumbnail"])
        if thumbnail not in image_paths:
            image_paths.append(thumbnail)
        for image_path in image_paths:
            candidate = (ROOT / "assets" / "images" / str(image_path)).resolve()
            images_root = (ROOT / "assets" / "images").resolve()
            if images_root not in candidate.parents or not candidate.is_file():
                raise ValueError(
                    f"Missing or unsafe image for {product_id}: {image_path}"
                )

    return products


def inline_shell(document: str, nav: str, footer: str, source_name: str) -> str:
    replacements = {
        '<div id="nav-placeholder"></div>': (
            '<div id="nav-placeholder">\n' + nav.strip() + "\n</div>"
        ),
        '<div id="footer-placeholder"></div>': (
            '<div id="footer-placeholder">\n' + footer.strip() + "\n</div>"
        ),
    }
    for marker, replacement in replacements.items():
        if document.count(marker) != 1:
            raise ValueError(f"{source_name} must contain exactly one {marker}")
        document = document.replace(marker, replacement)
    return document


def category_accent(product: dict[str, object]) -> str:
    colors = {
        "automotive-body-kits": "rgba(245, 91, 91, 0.15)",
        "roof-box": "rgba(91, 168, 245, 0.15)",
        "astronomy": "rgba(148, 91, 245, 0.15)",
        "industrial-solutions": "rgba(245, 185, 91, 0.15)",
        "development-production": "rgba(91, 245, 168, 0.15)",
    }
    key = str(product.get("categorySlug") or product.get("category") or "")
    return colors.get(key, "rgba(91, 168, 245, 0.1)")


def render_product_card(product: dict[str, object]) -> str:
    product_id = escaped(product["id"])
    name = escaped(product["name"])
    return f"""            <div class="col">
              <a href="/products/{product_id}.html" class="product-card text-decoration-none">
                <div class="card-img-wrap" style="--card-accent: {category_accent(product)}">
                  <img src="/assets/images/{escaped(product['thumbnail'])}"
                       alt="{name}"
                       class="card-img-pop"
                       loading="lazy"
                       width="300" height="280" />
                </div>
                <div class="card-body">
                  <span class="card-category">{escaped(product['category'])}</span>
                  <h3 class="card-title">{name}</h3>
                  <p class="card-text">{escaped(product['shortDescription'])}</p>
                </div>
              </a>
            </div>"""


def inject_catalog(document: str, products: list[dict[str, object]]) -> str:
    marker = "            <!-- BUILD:PRODUCT_CARDS -->"
    if document.count(marker) != 1:
        raise ValueError("industrial.html must contain one product-card build marker")
    cards = "\n".join(render_product_card(product) for product in products)
    return document.replace(marker, cards)


def product_url(product_id: object) -> str:
    return f"{SITE_URL}/products/{product_id}.html"


def render_breadcrumb(product: dict[str, object]) -> str:
    return f"""<nav id="breadcrumb" aria-label="Breadcrumb" class="reveal">
              <ol class="breadcrumb breadcrumb-telamorph">
                <li class="breadcrumb-item"><a href="/">Home</a></li>
                <li class="breadcrumb-item"><a href="/industrial.html">Industrial</a></li>
                <li class="breadcrumb-item active" aria-current="page">{escaped(product['name'])}</li>
              </ol>
            </nav>"""


def render_product_specifications(product: dict[str, object]) -> str:
    specifications = dict(product.get("specifications") or {})
    if not specifications:
        return ""

    spec_rows = "\n".join(
        '<div class="pd-spec-row">'
        f"<dt>{escaped(name)}</dt><dd>{escaped(value)}</dd>"
        "</div>"
        for name, value in specifications.items()
    )
    return f'''<section class="pd-specifications">
                    <h2 class="pd-detail-heading">Specifications</h2>
                    <dl class="pd-spec-list">{spec_rows}</dl>
                  </section>'''


def render_product_tabs(product: dict[str, object]) -> str:
    highlights = list(product.get("highlights") or [])
    highlight_items = "\n".join(
        f"<li>{escaped(item)}</li>" for item in highlights
    )

    sections: list[tuple[str, str, str]] = []
    if highlight_items:
        sections.append(
            ("highlights", "Highlights", f'<ul class="pd-highlights">{highlight_items}</ul>')
        )
    if not sections:
        return ""
    if len(sections) == 1:
        _, label, body = sections[0]
        return f"""<section class="pd-tabs pd-tabs-single">
              <h2 class="pd-tab-heading">{label}</h2>
              <div class="pd-tab-panel is-active">{body}</div>
            </section>"""

    buttons = []
    panels = []
    for index, (section_id, label, body) in enumerate(sections):
        active = index == 0
        buttons.append(
            f'<button type="button" role="tab" id="pd-tab-{section_id}" '
            f'class="pd-tab-btn{" is-active" if active else ""}" '
            f'aria-controls="pd-panel-{section_id}" '
            f'aria-selected="{"true" if active else "false"}">{label}</button>'
        )
        hidden = "" if active else " hidden"
        panels.append(
            f'<div id="pd-panel-{section_id}" role="tabpanel" '
            f'aria-labelledby="pd-tab-{section_id}" '
            f'class="pd-tab-panel{" is-active" if active else ""}"{hidden}>{body}</div>'
        )

    return f"""<section class="pd-tabs">
              <div class="pd-tab-nav" role="tablist" aria-label="Product details">
                {' '.join(buttons)}
              </div>
              <div class="pd-tab-panels">{' '.join(panels)}</div>
            </section>"""


def render_product_content(product: dict[str, object]) -> str:
    images = list(product.get("images") or [])
    hero_image = str(images[0] if images else product["thumbnail"])
    name = escaped(product["name"])

    thumbnails = ""
    if len(images) > 1:
        items = []
        for index, image_path in enumerate(images):
            active = " is-active" if index == 0 else ""
            items.append(
                f'<img src="/assets/images/{escaped(image_path)}" '
                f'alt="{name} image {index + 1}" class="pd-thumb{active}" '
                f'onclick="switchImage(this, {json.dumps(str(image_path))})" '
                'width="84" height="64" />'
            )
        thumbnails = f'<div class="pd-thumbs">{"".join(items)}</div>'

    return f"""<div id="product-content" data-product-id="{escaped(product['id'])}" class="reveal-stagger">
              <div class="pd-layout">
                <div class="pd-media reveal reveal-left">
                  <div class="pd-media-frame">
                    <img class="pd-media-img"
                         src="/assets/images/{escaped(hero_image)}"
                         alt="{name} — {escaped(product['category'])}"
                         width="600" height="450" />
                  </div>
                  {thumbnails}
                </div>
                <div class="pd-info reveal reveal-right">
                  <span class="pd-eyebrow">{escaped(product['category'])}</span>
                  <h1 class="pd-title">{name}</h1>
                  <p class="pd-lead">{escaped(product['description'])}</p>
                  {render_product_specifications(product)}
                </div>
              </div>
              <div class="pd-actions reveal">
                <a href="/contact.html" class="btn btn-accent btn-lg">Request a quote</a>
              </div>
              {render_product_tabs(product)}
            </div>"""


def product_schema(product: dict[str, object]) -> str:
    product_id = str(product["id"])
    url = product_url(product_id)
    images = [
        f"{SITE_URL}/assets/images/{image_path}"
        for image_path in list(product.get("images") or [])
    ]
    node: dict[str, object] = {
        "@type": "Product",
        "@id": f"{url}#product",
        "name": product["name"],
        "description": product.get("description") or product["shortDescription"],
        "sku": product_id,
        "category": product["category"],
        "url": url,
        "brand": {"@type": "Brand", "name": "Telamorph"},
        "manufacturer": {
            "@id": f"{SITE_URL}/#organization",
            "@type": "Organization",
            "name": "Telamorph",
            "url": f"{SITE_URL}/",
        },
    }
    if images:
        node["image"] = images
    specifications = dict(product.get("specifications") or {})
    if specifications:
        node["additionalProperty"] = [
            {"@type": "PropertyValue", "name": name, "value": value}
            for name, value in specifications.items()
        ]

    breadcrumb = {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE_URL}/"},
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Industrial",
                "item": f"{SITE_URL}/industrial.html",
            },
            {"@type": "ListItem", "position": 3, "name": product["name"], "item": url},
        ],
    }
    payload = {"@context": "https://schema.org", "@graph": [node, breadcrumb]}
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def render_product_page(
    template: str,
    product: dict[str, object],
    site_product: dict[str, object],
    nav: str,
    footer: str,
) -> str:
    """Render one product page; ``site_product`` carries the WebP image paths
    shown on the page, ``product`` the originals used in share/SEO metadata."""
    images = list(product.get("images") or [])
    hero_image = str(images[0] if images else product["thumbnail"])
    title = f"{product['name']} {product['category']} | Telamorph"
    replacements = {
        "@@HEAD_TITLE@@": escaped(title),
        "@@DESCRIPTION@@": escaped(product["shortDescription"]),
        "@@CANONICAL@@": escaped(product_url(product["id"])),
        "@@OG_TITLE@@": escaped(f"{product['name']} — Telamorph"),
        "@@OG_IMAGE@@": escaped(f"{SITE_URL}/assets/images/{hero_image}"),
        "@@IMAGE_ALT@@": escaped(f"{product['name']} — {product['category']}"),
        "@@PRODUCT_JSONLD@@": product_schema(product),
        "@@NAV@@": nav.strip(),
        "@@BREADCRUMB@@": render_breadcrumb(product),
        "@@PRODUCT_CONTENT@@": render_product_content(site_product),
        "@@FOOTER@@": footer.strip(),
    }
    document = template
    for marker, replacement in replacements.items():
        if document.count(marker) < 1:
            raise ValueError(f"Product template is missing {marker}")
        document = document.replace(marker, replacement)
    leftovers = sorted(set(re.findall(r"@@[A-Z_]+@@", document)))
    if leftovers:
        raise ValueError(f"Unresolved product template markers: {leftovers}")
    return document


def generate_sitemap(products: list[dict[str, object]]) -> str:
    urls = [f"{SITE_URL}{path}" for path in STATIC_SITEMAP_PATHS]
    urls.extend(product_url(product["id"]) for product in products)
    items = "\n".join(f"  <url><loc>{html.escape(url)}</loc></url>" for url in urls)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{items}\n"
        "</urlset>"
    )


def generate_llms(products: list[dict[str, object]]) -> str:
    template = read_text(ROOT / "templates" / "llms.txt")
    marker = "@@PRODUCT_LINKS@@"
    if template.count(marker) != 1:
        raise ValueError("templates/llms.txt must contain one product marker")
    product_links = "\n".join(
        f"- [{product['name']}]({product_url(product['id'])}): "
        f"{str(product['shortDescription']).strip()}"
        for product in products
    )
    return template.replace(marker, product_links)


def copy_production_directories() -> None:
    for name in COPY_DIRECTORIES:
        source = ROOT / name
        if not source.is_dir():
            raise FileNotFoundError(f"Missing production directory: {source}")
        # `private` folders (e.g. assets/pdfs/private) hold client source
        # material for editing the site; they must never be published.
        shutil.copytree(source, DIST / name, ignore=shutil.ignore_patterns("private"))


def publish_web_images() -> dict[str, str]:
    """Put the WebP copies into dist and map original paths to them.

    Paths are relative to assets/images. The full-size originals stay in the
    source tree; prune_replaced_images() later drops the ones no page needs.
    """
    web_images: dict[str, str] = {}
    for result in optimize_images.optimize():
        if result.webp:
            target = DIST / "assets" / "images" / result.webp
            shutil.copy2(optimize_images.CACHE / result.webp, target)
            web_images[result.source] = result.webp
    return web_images


def use_web_images(text: str, web_images: dict[str, str]) -> str:
    """Point page-rendered image references at their WebP copies.

    Absolute https://telamorph.com/... URLs (og:image, JSON-LD) keep the
    original, since not every link-preview crawler accepts WebP.
    """

    def replace(match: re.Match[str]) -> str:
        return "assets/images/" + web_images.get(match.group(1), match.group(1))

    return optimize_images.PAGE_IMAGE_PATTERN.sub(replace, text)


def web_product(product: dict[str, object], web_images: dict[str, str]) -> dict[str, object]:
    site_product = dict(product)
    site_product["thumbnail"] = web_images.get(str(product["thumbnail"]), product["thumbnail"])
    if product.get("images"):
        site_product["images"] = [
            web_images.get(str(path), path) for path in list(product["images"])
        ]
    return site_product


def dist_text_files() -> list[Path]:
    return [
        path
        for path in DIST.rglob("*")
        if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES
    ]


def referenced_images() -> set[str]:
    referenced: set[str] = set()
    for path in dist_text_files():
        text = read_text(path)
        referenced.update(m.group("path") for m in IMAGE_REFERENCE_PATTERN.finditer(text))
    for product in json.loads(read_text(DIST / "data" / "products.json")):
        referenced.add(str(product["thumbnail"]))
        referenced.update(str(path) for path in list(product.get("images") or []))
    return referenced


def prune_replaced_images(web_images: dict[str, str]) -> int:
    """Drop originals that have a WebP copy and are no longer referenced."""
    referenced = referenced_images()
    removed = 0
    for source in web_images:
        if source not in referenced:
            (DIST / "assets" / "images" / source).unlink()
            removed += 1
    return removed


def local_path_for_url(url: str, document_path: Path) -> Path | None:
    parsed = urlparse(url)
    if parsed.scheme or parsed.netloc or url.startswith(("mailto:", "tel:", "data:")):
        return None
    path = parsed.path
    if not path or path == "/":
        return DIST / "index.html"
    if path.startswith("/api/"):
        return None
    if path.startswith("/"):
        candidate = DIST / path.lstrip("/")
    else:
        candidate = document_path.parent / path
    if path.endswith("/"):
        candidate = candidate / "index.html"
    return candidate.resolve()


def validate_images(web_images: dict[str, str]) -> list[str]:
    broken: list[str] = []
    images_root = DIST / "assets" / "images"
    for path in referenced_images():
        if not (images_root / path).is_file():
            broken.append(f"missing image assets/images/{path}")
    for document_path in dist_text_files():
        text = read_text(document_path)
        for match in optimize_images.PAGE_IMAGE_PATTERN.finditer(text):
            if match.group(1) in web_images:
                broken.append(
                    f"{document_path.relative_to(DIST)} shows the full-size "
                    f"{match.group(1)} instead of its WebP copy"
                )
    return broken


def validate_dist(products: list[dict[str, object]], web_images: dict[str, str]) -> None:
    expected_top_level = {
        *STATIC_PAGES,
        *STANDALONE_PAGES,
        *COPY_DIRECTORIES,
        "products",
        "robots.txt",
        "sitemap.xml",
        "llms.txt",
    }
    actual_top_level = {path.name for path in DIST.iterdir()}
    if actual_top_level != expected_top_level:
        missing = sorted(expected_top_level - actual_top_level)
        unexpected = sorted(actual_top_level - expected_top_level)
        raise RuntimeError(f"Bad deploy inventory; missing={missing}, unexpected={unexpected}")

    generated_products = sorted((DIST / "products").glob("*.html"))
    if len(generated_products) != len(products):
        raise RuntimeError("Generated product-page count does not match products.json")

    html_files = [DIST / name for name in (*STATIC_PAGES, *STANDALONE_PAGES)] + generated_products
    broken: list[str] = []
    for document_path in html_files:
        document = read_text(document_path)
        if document_path.name not in STANDALONE_PAGES and (
            "navbar-telamorph" not in document or "footer-telamorph" not in document
        ):
            broken.append(f"{document_path.relative_to(DIST)}: shell was not embedded")
        for match in LOCAL_REFERENCE_PATTERN.finditer(document):
            url = match.group("url")
            target = local_path_for_url(url, document_path)
            if target is not None and not target.exists():
                broken.append(f"{document_path.relative_to(DIST)} -> {url}")

    broken.extend(validate_images(web_images))

    forbidden_names = {"functions", ".venv", ".agents", "client_explanation"}
    leaked = sorted(path for path in forbidden_names if (DIST / path).exists())
    leaked += sorted(
        str(path.relative_to(DIST)) for path in DIST.rglob("private") if path.is_dir()
    )
    if leaked:
        broken.append(f"Forbidden deploy entries: {', '.join(leaked)}")
    if broken:
        raise RuntimeError("Build validation failed:\n- " + "\n- ".join(broken))


def main() -> None:
    products = load_products()
    nav = read_text(ROOT / "components" / "nav.html")
    footer = read_text(ROOT / "components" / "footer.html")
    product_template = read_text(ROOT / "templates" / "product.html")

    reset_dist()
    copy_production_directories()
    web_images = publish_web_images()
    site_products = [web_product(product, web_images) for product in products]
    write_text(
        DIST / "data" / "products.json",
        json.dumps(site_products, indent=2, ensure_ascii=False),
    )
    for stylesheet in (DIST / "assets" / "css").rglob("*.css"):
        write_text(stylesheet, use_web_images(read_text(stylesheet), web_images))

    for name in STANDALONE_PAGES:
        shutil.copy2(ROOT / name, DIST / name)

    for name in STATIC_PAGES:
        document = read_text(ROOT / name)
        if name == "industrial.html":
            document = inject_catalog(document, site_products)
        document = inline_shell(document, nav, footer, name)
        write_text(DIST / name, use_web_images(document, web_images))

    for product, site_product in zip(products, site_products):
        document = render_product_page(product_template, product, site_product, nav, footer)
        write_text(DIST / "products" / f"{product['id']}.html", document)

    sitemap = generate_sitemap(products)
    llms = generate_llms(products)
    write_text(ROOT / "sitemap.xml", sitemap)
    write_text(ROOT / "llms.txt", llms)
    write_text(DIST / "sitemap.xml", sitemap)
    write_text(DIST / "llms.txt", llms)
    shutil.copy2(ROOT / "robots.txt", DIST / "robots.txt")

    pruned = prune_replaced_images(web_images)
    validate_dist(products, web_images)
    file_count = sum(1 for path in DIST.rglob("*") if path.is_file())
    size_mb = sum(path.stat().st_size for path in DIST.rglob("*") if path.is_file()) / (1024 * 1024)
    print(f"Built {file_count} deploy files ({size_mb:.1f} MB) in {DIST}")
    print(
        f"Published {len(web_images)} WebP images; dropped {pruned} unused "
        f"full-size originals ({len(web_images) - pruned} kept for share/SEO links)"
    )
    print(f"Generated {len(products)} static product pages")
    print("Validation passed: only the allowlisted production payload will deploy")


if __name__ == "__main__":
    main()
