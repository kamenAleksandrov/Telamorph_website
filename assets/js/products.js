/* ==========================================================================
   Telamorph — Products Listing Page (products.js)
   Loads products from JSON, renders cards with category filter
   Supports ?cat= URL param for direct category links from nav
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const products = await loadJSON("data/products.json");
  if (!products.length) return;

  initBreadcrumb();
  const activeCat = getParam("cat") || null;

  if (activeCat) {
    // Filter to products in this category, show subcategory filters
    const catProducts = products.filter(p => p.categorySlug === activeCat);
    const catLabel = catProducts.length ? catProducts[0].category : activeCat;
    updatePageHeading(catLabel);
    initSubcategoryFilters(catProducts);
    renderProducts(catProducts);
  } else {
    // No category selected — show all with category-level filters
    initFilters(products, null);
    renderProducts(products);
  }
});

function initBreadcrumb() {
  const el = document.getElementById("breadcrumb");
  if (el) {
    renderBreadcrumb(el, [
      { label: "Home", href: "index.html" },
      { label: "Products" }
    ]);
  }
}

/**
 * Update the page heading to show the active category name.
 */
function updatePageHeading(categoryLabel) {
  const title = document.querySelector(".products-header .section-title");
  const subtitle = document.querySelector(".products-header .section-subtitle");
  if (title) title.textContent = categoryLabel;
  if (subtitle) subtitle.textContent = "Filter by subcategory below.";
}

/**
 * Build subcategory filter pills for products within a single category.
 */
function initSubcategoryFilters(catProducts) {
  const container = document.getElementById("category-filters");
  if (!container) return;

  // "All" pill — shows all products in this category
  const allBtn = document.createElement("button");
  allBtn.className = "filter-pill active";
  allBtn.textContent = "All";
  allBtn.type = "button";
  allBtn.addEventListener("click", () => {
    setActiveFilter(container, allBtn);
    renderProducts(catProducts);
  });
  container.appendChild(allBtn);

  // Subcategory pills
  const subs = [...new Set(catProducts.map(p => p.subcategorySlug))];
  subs.forEach(subSlug => {
    const label = catProducts.find(p => p.subcategorySlug === subSlug).subcategory;
    const btn = document.createElement("button");
    btn.className = "filter-pill";
    btn.textContent = label;
    btn.type = "button";
    btn.addEventListener("click", () => {
      setActiveFilter(container, btn);
      renderProducts(catProducts.filter(p => p.subcategorySlug === subSlug));
    });
    container.appendChild(btn);
  });
}

/**
 * Build category filter pills from product data.
 * Used when no ?cat= is present (all products view).
 */
function initFilters(products, activeCat) {
  const container = document.getElementById("category-filters");
  if (!container) return;

  // "All" pill
  const allBtn = document.createElement("button");
  allBtn.className = "filter-pill active";
  allBtn.textContent = "All";
  allBtn.type = "button";
  allBtn.addEventListener("click", () => {
    setActiveFilter(container, allBtn);
    renderProducts(products);
  });
  container.appendChild(allBtn);

  // Category pills — link to ?cat= to switch to subcategory view
  const slugs = [...new Set(products.map(p => p.categorySlug))];
  slugs.forEach(slug => {
    const label = products.find(p => p.categorySlug === slug).category;
    const btn = document.createElement("a");
    btn.className = "filter-pill";
    btn.textContent = label;
    btn.href = `products.html?cat=${encodeURIComponent(slug)}`;
    container.appendChild(btn);
  });
}

function setActiveFilter(container, activeBtn) {
  container.querySelectorAll(".filter-pill").forEach(b => b.classList.remove("active"));
  activeBtn.classList.add("active");
}

function updateURL(cat) {
  const url = new URL(window.location);
  if (cat) {
    url.searchParams.set("cat", cat);
  } else {
    url.searchParams.delete("cat");
  }
  history.replaceState(null, "", url);
}

/**
 * Render product cards into the grid.
 */
function renderProducts(products) {
  const grid = document.getElementById("product-grid");
  if (!grid) return;
  grid.innerHTML = "";
  if (!products.length) {
    grid.innerHTML = '<div class="col-12 text-center py-4" style="color: var(--text-muted);">No products in this category yet.</div>';
    return;
  }
  products.forEach(product => {
    grid.appendChild(createProductCard(product));
  });
}
