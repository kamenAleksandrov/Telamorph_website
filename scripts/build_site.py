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


ROOT = Path(__file__).resolve().parents[1]
DIST = (ROOT / "dist").resolve()
SITE_URL = "https://telamorph.com"

STATIC_PAGES = (
    "index.html",
    "about.html",
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
    "/contact.html",
    "/resellers.html",
)

COPY_DIRECTORIES = ("assets", "components", "data")
PRODUCT_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LOCAL_REFERENCE_PATTERN = re.compile(
    r"(?:href|src)=[\"'](?P<url>[^\"'#]+)[\"']", re.IGNORECASE
)


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
    template: str, product: dict[str, object], nav: str, footer: str
) -> str:
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
        "@@PRODUCT_CONTENT@@": render_product_content(product),
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
        shutil.copytree(source, DIST / name)


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


def validate_dist(products: list[dict[str, object]]) -> None:
    expected_top_level = {
        *STATIC_PAGES,
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

    html_files = [DIST / name for name in STATIC_PAGES] + generated_products
    broken: list[str] = []
    for document_path in html_files:
        document = read_text(document_path)
        if "navbar-telamorph" not in document or "footer-telamorph" not in document:
            broken.append(f"{document_path.relative_to(DIST)}: shell was not embedded")
        for match in LOCAL_REFERENCE_PATTERN.finditer(document):
            url = match.group("url")
            target = local_path_for_url(url, document_path)
            if target is not None and not target.exists():
                broken.append(f"{document_path.relative_to(DIST)} -> {url}")

    forbidden_names = {"functions", ".venv", ".agents", "client_explanation"}
    leaked = sorted(path for path in forbidden_names if (DIST / path).exists())
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

    for name in STATIC_PAGES:
        document = read_text(ROOT / name)
        if name == "industrial.html":
            document = inject_catalog(document, products)
        document = inline_shell(document, nav, footer, name)
        write_text(DIST / name, document)

    for product in products:
        document = render_product_page(product_template, product, nav, footer)
        write_text(DIST / "products" / f"{product['id']}.html", document)

    sitemap = generate_sitemap(products)
    llms = generate_llms(products)
    write_text(ROOT / "sitemap.xml", sitemap)
    write_text(ROOT / "llms.txt", llms)
    write_text(DIST / "sitemap.xml", sitemap)
    write_text(DIST / "llms.txt", llms)
    shutil.copy2(ROOT / "robots.txt", DIST / "robots.txt")

    validate_dist(products)
    file_count = sum(1 for path in DIST.rglob("*") if path.is_file())
    size_mb = sum(path.stat().st_size for path in DIST.rglob("*") if path.is_file()) / (1024 * 1024)
    print(f"Built {file_count} deploy files ({size_mb:.1f} MB) in {DIST}")
    print(f"Generated {len(products)} static product pages")
    print("Validation passed: only the allowlisted production payload will deploy")


if __name__ == "__main__":
    main()
