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

  // Build specs rows
  const specRows = Object.entries(product.specifications)
    .map(([key, val]) => `<tr><td>${escapeHTML(key)}</td><td>${escapeHTML(val)}</td></tr>`)
    .join("");

  // Build mailto link
  const mailto = buildMailto(
    product.quoteEmail,
    `Quote Request: ${product.name}`
  );

  container.innerHTML = `
    <!-- Image column -->
    <div class="col-lg-6 reveal">
      <img class="product-gallery-main"
           src="assets/images/${product.images[0] || product.thumbnail}" 
           alt="${escapeHTML(product.name)}"
           width="600" height="450">
      ${product.images.length > 1 ? `
        <div class="product-gallery-thumbs">
          ${product.images.map((img, i) => `
            <img src="assets/images/${img}" 
                 alt="${escapeHTML(product.name)} image ${i + 1}" 
                 class="${i === 0 ? 'active' : ''}"
                 onclick="switchImage(this, '${img}')"
                 width="72" height="54">
          `).join("")}
        </div>
      ` : ""}
    </div>

    <!-- Detail column -->
    <div class="col-lg-6 reveal">
      <span class="card-category">${escapeHTML(product.category)}</span>
      <h1 class="section-title">${escapeHTML(product.name)}</h1>
      <p style="color: var(--text-secondary); margin-bottom: 2rem;">${product.description}</p>

      <h2 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem;">Specifications</h2>
      <table class="spec-table">${specRows}</table>

      <div class="mt-4">
        <a href="${mailto}" class="btn btn-accent btn-lg">Request a Quote</a>
        <a href="products.html" class="btn btn-outline-accent btn-lg ms-2">All Products</a>
      </div>
    </div>
  `;
  window.initCursorStreaks?.(container);
  window.initRevealOnScroll?.(container);
}

/**
 * Switch the main gallery image on thumbnail click.
 */
function switchImage(thumb, imgPath) {
  const main = document.querySelector(".product-gallery-main");
  if (main) main.src = `assets/images/${imgPath}`;

  document.querySelectorAll(".product-gallery-thumbs img").forEach(t => t.classList.remove("active"));
  thumb.classList.add("active");
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
