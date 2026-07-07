/* ==========================================================================
   Telamorph — Product Detail Page (product-detail.js)
   Loads a single product by ?id= param, renders full detail view
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const productId = getParam("id");
  if (!productId) return showNotFound();

  const products = await loadJSON("data/products.json");
  const product = products.find((p) => p.id === productId);

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
  if (canonical)
    canonical.setAttribute(
      "href",
      `https://telamorph.com/product-detail.html?id=${product.id}`,
    );

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
      { label: "Industrial", href: "industrial.html" },
      { label: product.name },
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
        `<div class="pd-spec-row"><dt>${escapeHTML(key)}</dt><dd>${escapeHTML(val)}</dd></div>`,
    )
    .join("");

  // Scannable feature list — the qualitative highlights for the product
  const highlightItems = (product.highlights || [])
    .map((item) => `<li>${escapeHTML(item)}</li>`)
    .join("");

  const mailto = buildMailto(
    product.quoteEmail,
    `Quote Request: ${product.name}`,
  );

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
                 width="84" height="64">`,
            )
            .join("")}
        </div>`
      : "";

  // Detail sections live below the hero as tabs. Only the sections that have
  // content become tabs (a product with no specs shows just Highlights).
  const tabs = [];
  if (highlightItems) {
    tabs.push({
      id: "highlights",
      label: "Highlights",
      body: `<ul class="pd-highlights">${highlightItems}</ul>`,
    });
  }
  if (specRows) {
    tabs.push({
      id: "specs",
      label: "Specifications",
      body: `<dl class="pd-spec-list">${specRows}</dl>`,
    });
  }

  const tabsMarkup = buildTabsMarkup(tabs);

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

        <div class="pd-actions">
          <a href="${mailto}" class="btn btn-accent btn-lg">Request a quote</a>
        </div>
      </div>
    </div>

    ${tabsMarkup}
  `;
  bindProductTabs(container);
  window.initCursorStreaks?.(container);
  window.initRevealOnScroll?.(container);
}

/**
 * Build the tabbed detail section markup from an array of {id, label, body}.
 * Two or more tabs render a tab bar; a single section drops the bar and just
 * shows its heading + content.
 */
function buildTabsMarkup(tabs) {
  if (!tabs.length) return "";

  if (tabs.length === 1) {
    const t = tabs[0];
    return `
      <section class="pd-tabs pd-tabs-single reveal">
        <h2 class="pd-tab-heading">${t.label}</h2>
        <div class="pd-tab-panel is-active">${t.body}</div>
      </section>`;
  }

  const nav = tabs
    .map(
      (t, i) =>
        `<button type="button" role="tab" id="pd-tab-${t.id}"
                 class="pd-tab-btn${i === 0 ? " is-active" : ""}"
                 aria-controls="pd-panel-${t.id}"
                 aria-selected="${i === 0 ? "true" : "false"}">${t.label}</button>`,
    )
    .join("");

  const panels = tabs
    .map(
      (t, i) =>
        `<div id="pd-panel-${t.id}" role="tabpanel" aria-labelledby="pd-tab-${t.id}"
              class="pd-tab-panel${i === 0 ? " is-active" : ""}"${i === 0 ? "" : " hidden"}>${t.body}</div>`,
    )
    .join("");

  return `
    <section class="pd-tabs reveal">
      <div class="pd-tab-nav" role="tablist" aria-label="Product details">${nav}</div>
      <div class="pd-tab-panels">${panels}</div>
    </section>`;
}

/**
 * Wire up click/keyboard switching for the detail tabs.
 */
function bindProductTabs(container) {
  const buttons = Array.from(container.querySelectorAll(".pd-tab-btn"));
  if (buttons.length < 2) return;

  const activate = (btn) => {
    const panelId = btn.getAttribute("aria-controls");
    buttons.forEach((b) => {
      const isActive = b === btn;
      b.classList.toggle("is-active", isActive);
      b.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    container.querySelectorAll(".pd-tab-panel").forEach((panel) => {
      const isActive = panel.id === panelId;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  };

  buttons.forEach((btn, i) => {
    btn.addEventListener("click", () => activate(btn));
    btn.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = buttons[(i + dir + buttons.length) % buttons.length];
      activate(next);
      next.focus();
    });
  });
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
    name: product.name,
    description: product.shortDescription,
    brand: {
      "@type": "Brand",
      name: "Telamorph",
    },
    category: product.category,
    image: product.images.map(
      (img) => `https://telamorph.com/assets/images/${img}`,
    ),
  };

  el.textContent = JSON.stringify(data);
}
