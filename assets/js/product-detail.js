/* ==========================================================================
   Telamorph — Product Detail Page (product-detail.js)
   Loads a single product by ?id= param, renders full detail view
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const productId = getParam("id");
  if (!productId) return showNotFound();

  const products = await loadJSON("data/products.json");
  const product = products.find(p => p.id === productId);

  if (!product) return showNotFound();

  updateMeta(product);
  initBreadcrumb(product);
  renderProduct(product);
  injectStructuredData(product);
});

function showNotFound() {
  const content = document.getElementById("product-content");
  const fallback = document.getElementById("product-not-found");
  if (content) content.style.display = "none";
  if (fallback) fallback.style.display = "block";
}

/**
 * Update page title and meta tags for SEO.
 */
function updateMeta(product) {
  document.title = `${product.name} — Telamorph`;

  const desc = document.getElementById("page-description");
  if (desc) desc.setAttribute("content", product.shortDescription);

  const canonical = document.getElementById("page-canonical");
  if (canonical) canonical.setAttribute("href", `https://telamorph.com/product-detail.html?id=${product.id}`);

  const ogTitle = document.getElementById("og-title");
  if (ogTitle) ogTitle.setAttribute("content", product.name);

  const ogDesc = document.getElementById("og-description");
  if (ogDesc) ogDesc.setAttribute("content", product.shortDescription);
}

function initBreadcrumb(product) {
  const el = document.getElementById("breadcrumb");
  if (el) {
    renderBreadcrumb(el, [
      { label: "Home", href: "index.html" },
      { label: "Products", href: "products.html" },
      { label: product.name }
    ]);
  }
}

/**
 * Render full product detail view.
 */
function renderProduct(product) {
  const container = document.getElementById("product-content");
  if (!container) return;

  // Quiet spec rows — label on the left, value on the right
  const specRows = Object.entries(product.specifications || {})
    .map(
      ([key, val]) =>
        `<div class="pd-spec-row"><dt>${escapeHTML(key)}</dt><dd>${escapeHTML(val)}</dd></div>`
    )
    .join("");

  const mailto = buildMailto(product.quoteEmail, `Quote Request: ${product.name}`);

  // Back link points to the product's own category landing
  const categoryHref =
    product.categorySlug === "industrial-solutions"
      ? "industrial.html"
      : `products.html?cat=${encodeURIComponent(product.categorySlug || "")}`;

  const heroImg = product.images?.[0] || product.thumbnail;

  const thumbs =
    product.images && product.images.length > 1
      ? `
        <div class="pd-thumbs">
          ${product.images
            .map(
              (img, i) => `
            <img src="assets/images/${img}"
                 alt="${escapeHTML(product.name)} image ${i + 1}"
                 class="pd-thumb ${i === 0 ? "is-active" : ""}"
                 onclick="switchImage(this, '${img}')"
                 width="84" height="64">`
            )
            .join("")}
        </div>`
      : "";

  container.innerHTML = `
    <div class="pd-layout">
      <!-- Media -->
      <div class="pd-media reveal reveal-left">
        <div class="pd-media-frame">
          <img class="pd-media-img"
               src="assets/images/${heroImg}"
               alt="${escapeHTML(product.name)}"
               width="600" height="450">
        </div>
        ${thumbs}
      </div>

      <!-- Info -->
      <div class="pd-info reveal reveal-right">
        <span class="pd-eyebrow">${escapeHTML(product.category)}</span>
        <h1 class="pd-title">${escapeHTML(product.name)}</h1>
        <p class="pd-lead">${escapeHTML(product.description)}</p>

        ${
          specRows
            ? `<h2 class="pd-specs-title">Specifications</h2>
               <dl class="pd-spec-list">${specRows}</dl>`
            : ""
        }

        <div class="pd-actions">
          <a href="${mailto}" class="btn btn-accent btn-lg">Request a quote</a>
          <a href="${categoryHref}" class="btn btn-outline-accent btn-lg">Back to ${escapeHTML(
    product.category
  )}</a>
        </div>
      </div>
    </div>
  `;
  window.initCursorStreaks?.(container);
  window.initRevealOnScroll?.(container);
}

/**
 * Switch the main image on thumbnail click.
 */
function switchImage(thumb, imgPath) {
  const main = document.querySelector(".pd-media-img");
  if (main) main.src = `assets/images/${imgPath}`;

  document
    .querySelectorAll(".pd-thumb")
    .forEach((t) => t.classList.remove("is-active"));
  thumb.classList.add("is-active");
}

/**
 * Inject JSON-LD Product structured data for SEO.
 */
function injectStructuredData(product) {
  const el = document.getElementById("product-jsonld");
  if (!el) return;

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.shortDescription,
    "brand": {
      "@type": "Brand",
      "name": "Telamorph"
    },
    "category": product.category,
    "image": product.images.map(img => `https://telamorph.com/assets/images/${img}`)
  };

  el.textContent = JSON.stringify(data);
}
