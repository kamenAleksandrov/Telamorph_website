/* ==========================================================================
   Telamorph — Shared Utilities (utils.js)
   Helper functions used across pages
   ========================================================================== */

/**
 * Fetch and parse a JSON file. Returns parsed data or empty array on error.
 */
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Failed to load ${path}:`, err);
    return [];
  }
}

/**
 * Read a URL query parameter by name.
 */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Build a mailto link with a pre-filled subject.
 */
function buildMailto(email, subject) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`;
}

/**
 * Render a breadcrumb into a container element.
 * @param {HTMLElement} container
 * @param {Array<{label: string, href?: string}>} items
 */
function renderBreadcrumb(container, items) {
  const ol = document.createElement("ol");
  ol.className = "breadcrumb breadcrumb-telamorph";
  items.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "breadcrumb-item" + (i === items.length - 1 ? " active" : "");
    if (item.href && i < items.length - 1) {
      const a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.label;
      li.appendChild(a);
    } else {
      li.textContent = item.label;
    }
    ol.appendChild(li);
  });
  container.innerHTML = "";
  container.appendChild(ol);
}

/**
 * Create a product card element with pop-out image effect.
 */
function createProductCard(product) {
  const col = document.createElement("div");
  col.className = "col";

  const card = document.createElement("a");
  card.href = `product-detail.html?id=${encodeURIComponent(product.id)}`;
  card.className = "product-card text-decoration-none";

  // Build category-based accent colour for the card bg on hover
  const accentColor = getCategoryColor(product.categorySlug || product.category);

  card.innerHTML = `
    <div class="card-img-wrap" style="--card-accent: ${accentColor}">
      <img src="assets/images/${product.thumbnail}" 
           alt="${escapeHTML(product.name)}" 
           class="card-img-pop" 
           loading="lazy" 
           width="300" height="280">
    </div>
    <div class="card-body">
      <span class="card-category">${escapeHTML(product.category)}</span>
      <h3 class="card-title">${escapeHTML(product.name)}</h3>
      <p class="card-text">${escapeHTML(product.shortDescription)}</p>
    </div>
  `;

  // Apply accent bg colour on hover (Nabertherm-style effect)
  const imgWrap = card.querySelector(".card-img-wrap");
  card.addEventListener("mouseenter", () => {
    imgWrap.style.backgroundColor = accentColor;
  });
  card.addEventListener("mouseleave", () => {
    imgWrap.style.backgroundColor = "";
  });

  col.appendChild(card);
  return col;
}

/**
 * Return a subtle accent colour for each product category.
 */
function getCategoryColor(category) {
  const colors = {
    "automotive-body-kits": "rgba(245, 91, 91, 0.15)",
    "roof-box": "rgba(91, 168, 245, 0.15)",
    "astronomy": "rgba(148, 91, 245, 0.15)",
    "industrial-solutions": "rgba(245, 185, 91, 0.15)",
    "development-production": "rgba(91, 245, 168, 0.15)"
  };
  return colors[category] || "rgba(91, 168, 245, 0.1)";
}

/**
 * Escape HTML to prevent XSS when inserting user/data content.
 */
function escapeHTML(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Extract unique categories from a products array.
 */
function getCategories(products) {
  return [...new Set(products.map(p => p.category))].sort();
}
