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
 * Update page title and meta tags (SEO + social share) for the loaded product.
 */
function updateMeta(product) {
  const base = "https://telamorph.com";
  const url = `${base}/product-detail.html?id=${product.id}`;
  const heroImg = product.images?.[0] || product.thumbnail;
  const imageUrl = heroImg ? `${base}/assets/images/${heroImg}` : "";

  document.title = `${product.name} — Telamorph`;

  const setAttr = (id, attr, value) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, value);
  };

  setAttr("page-description", "content", product.shortDescription);
  setAttr("page-canonical", "href", url);

  // Open Graph
  setAttr("og-title", "content", product.name);
  setAttr("og-description", "content", product.shortDescription);
  setAttr("og-url", "content", url);
  if (imageUrl) setAttr("og-image", "content", imageUrl);

  // Twitter
  setAttr("tw-title", "content", product.name);
  setAttr("tw-description", "content", product.shortDescription);
  if (imageUrl) setAttr("tw-image", "content", imageUrl);
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
          <a href="contact.html" class="btn btn-accent btn-lg">Request a quote</a>
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
 * Inject JSON-LD structured data (Product + BreadcrumbList) for SEO and AI.
 * Specs are emitted as PropertyValue entries so search engines and LLMs can
 * read the technical data, not just the prose.
 */
function injectStructuredData(product) {
  const el = document.getElementById("product-jsonld");
  if (!el) return;

  const base = "https://telamorph.com";
  const url = `${base}/product-detail.html?id=${product.id}`;
  const images = (product.images || []).map(
    (img) => `${base}/assets/images/${img}`,
  );
  const additionalProperty = Object.entries(product.specifications || {}).map(
    ([name, value]) => ({ "@type": "PropertyValue", name, value }),
  );

  const productNode = {
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    description: product.description || product.shortDescription,
    sku: product.id,
    category: product.category,
    url,
    brand: { "@type": "Brand", name: "Telamorph" },
    manufacturer: {
      "@id": `${base}/#organization`,
      "@type": "Organization",
      name: "Telamorph",
      url: `${base}/`,
    },
  };
  if (images.length) productNode.image = images;
  if (additionalProperty.length)
    productNode.additionalProperty = additionalProperty;

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Industrial",
        item: `${base}/industrial.html`,
      },
      { "@type": "ListItem", position: 3, name: product.name, item: url },
    ],
  };

  el.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [productNode, breadcrumb],
  });
}
