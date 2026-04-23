/* ==========================================================================
   Telamorph — Products Listing Page (products.js)
   Loads product data once, renders category views, and switches categories
   in-place so product-tab clicks do not force a full document reload.
   ========================================================================== */

let allProducts = [];

initProductsPage();

async function initProductsPage() {
  allProducts = await loadJSON("data/products.json");
  if (!allProducts.length) return;

  bindCategoryNavigation();
  window.addEventListener("popstate", renderCurrentProductsView);
  renderCurrentProductsView();
}

function isProductsPage() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  return currentPage === "products.html";
}

function initBreadcrumb() {
  const el = document.getElementById("breadcrumb");
  if (!el) return;

  const activeCat = getParam("cat") || null;
  const activeProduct = activeCat
    ? allProducts.find((product) => product.categorySlug === activeCat)
    : null;

  renderBreadcrumb(el, [
    { label: "Home", href: "index.html" },
    { label: "Products", href: activeProduct ? "products.html" : undefined },
    ...(activeProduct ? [{ label: activeProduct.category }] : [])
  ]);
}

function resetPageHeading() {
  const title = document.querySelector(".products-header .section-title");
  const subtitle = document.querySelector(".products-header .section-subtitle");
  if (title) title.textContent = "Products";
  if (subtitle) subtitle.textContent = "Browse our full range of engineering hardware.";
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

function clearFilters() {
  const container = document.getElementById("category-filters");
  if (container) container.innerHTML = "";
}

function renderCurrentProductsView() {
  if (!allProducts.length) return;

  clearFilters();
  initBreadcrumb();

  const activeCat = getParam("cat") || null;
  setActiveProductTabs(activeCat);

  if (activeCat) {
    const catProducts = allProducts.filter((product) => product.categorySlug === activeCat);
    const catLabel = catProducts.length ? catProducts[0].category : activeCat;
    updatePageHeading(catLabel);
    initSubcategoryFilters(catProducts);
    renderProducts(catProducts);
    return;
  }

  resetPageHeading();
  initFilters(allProducts);
  renderProducts(allProducts);
}

function bindCategoryNavigation() {
  document.addEventListener("click", (event) => {
    if (!isProductsPage()) return;

    const link = event.target.closest("a[href]");
    if (!link) return;

    const targetURL = new URL(link.href, window.location.href);
    const targetPage = targetURL.pathname.split("/").pop() || "index.html";
    if (targetPage !== "products.html") return;

    const currentURL = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextURL = `${targetURL.pathname}${targetURL.search}${targetURL.hash}`;
    const nextCat = targetURL.searchParams.get("cat");
    const isCategoryRoute = Boolean(nextCat) || targetURL.searchParams.toString() === "";

    if (!isCategoryRoute) return;

    event.preventDefault();
    if (nextURL === currentURL) return;

    history.pushState(null, "", nextURL);
    renderCurrentProductsView();
  });
}

function setActiveProductTabs(activeCat) {
  document.querySelectorAll(".product-tab").forEach((tab) => {
    const isActive = Boolean(activeCat) && tab.getAttribute("data-category") === activeCat;
    tab.classList.toggle("active", isActive);
  });
}

/**
 * Build subcategory filter pills for products within a single category.
 */
function initSubcategoryFilters(catProducts) {
  const container = document.getElementById("category-filters");
  if (!container) return;

  const allBtn = document.createElement("button");
  allBtn.className = "filter-pill active";
  allBtn.textContent = "All";
  allBtn.type = "button";
  allBtn.addEventListener("click", () => {
    setActiveFilter(container, allBtn);
    renderProducts(catProducts);
  });
  container.appendChild(allBtn);

  const subs = [...new Set(catProducts.map((product) => product.subcategorySlug))];
  subs.forEach((subSlug) => {
    const label = catProducts.find((product) => product.subcategorySlug === subSlug)?.subcategory;
    if (!label) return;

    const btn = document.createElement("button");
    btn.className = "filter-pill";
    btn.textContent = label;
    btn.type = "button";
    btn.addEventListener("click", () => {
      setActiveFilter(container, btn);
      renderProducts(catProducts.filter((product) => product.subcategorySlug === subSlug));
    });
    container.appendChild(btn);
  });
}

/**
 * Build category filter pills from product data.
 * Used when no ?cat= is present (all products view).
 */
function initFilters(products) {
  const container = document.getElementById("category-filters");
  if (!container) return;

  const allBtn = document.createElement("button");
  allBtn.className = "filter-pill active";
  allBtn.textContent = "All";
  allBtn.type = "button";
  allBtn.addEventListener("click", () => {
    setActiveFilter(container, allBtn);
    renderProducts(products);
  });
  container.appendChild(allBtn);

  const slugs = [...new Set(products.map((product) => product.categorySlug))];
  slugs.forEach((slug) => {
    const label = products.find((product) => product.categorySlug === slug)?.category;
    if (!label) return;

    const btn = document.createElement("a");
    btn.className = "filter-pill";
    btn.textContent = label;
    btn.href = `products.html?cat=${encodeURIComponent(slug)}`;
    container.appendChild(btn);
  });
}

function setActiveFilter(container, activeBtn) {
  container.querySelectorAll(".filter-pill").forEach((button) => button.classList.remove("active"));
  activeBtn.classList.add("active");
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

  products.forEach((product) => {
    const card = createProductCard(product);
    card.classList.add("reveal");
    grid.appendChild(card);
  });
  window.initCursorStreaks?.(grid);
  window.initRevealOnScroll?.(grid);
}
