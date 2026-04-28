/* ==========================================================================
   Telamorph — Products Listing Page (products.js)
   Loads product data once, renders category views, and switches categories
   in-place so product-tab clicks do not force a full document reload.
   ========================================================================== */

let allProducts = [];
let productFilters = getFiltersFromURL();
let filterInputTimer = null;

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
  if (subtitle) subtitle.textContent = "Browse and refine our full range of engineering hardware.";
}

/**
 * Update the page heading to show the active category name.
 */
function updatePageHeading(categoryLabel) {
  const title = document.querySelector(".products-header .section-title");
  const subtitle = document.querySelector(".products-header .section-subtitle");
  if (title) title.textContent = categoryLabel;
  if (subtitle) subtitle.textContent = "Refine by subcategory, price, or product name.";
}

function renderCurrentProductsView() {
  if (!allProducts.length) return;

  productFilters = getFiltersFromURL();
  initBreadcrumb();

  const activeCat = productFilters.category || null;
  setActiveProductTabs(activeCat);

  if (activeCat) {
    const activeProduct = allProducts.find((product) => product.categorySlug === activeCat);
    const catLabel = activeProduct?.category || activeCat;
    updatePageHeading(catLabel);
  } else {
    resetPageHeading();
  }

  initFilters(allProducts);
  applyAndRenderFilters();
}

function getFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get("q") || "",
    category: params.get("cat") || "",
    subcategory: params.get("sub") || "",
    minPrice: params.get("min") || "",
    maxPrice: params.get("max") || ""
  };
}

function updateFilters(nextFilters, { replace = true } = {}) {
  productFilters = {
    ...productFilters,
    ...nextFilters
  };

  syncURLFromFilters(replace);
  syncFilterControls();
  initBreadcrumb();
  setActiveProductTabs(productFilters.category || null);

  if (productFilters.category) {
    const activeProduct = allProducts.find((product) => product.categorySlug === productFilters.category);
    updatePageHeading(activeProduct?.category || productFilters.category);
  } else {
    resetPageHeading();
  }

  applyAndRenderFilters();
}

function syncURLFromFilters(replace = true) {
  const params = new URLSearchParams();
  if (productFilters.search) params.set("q", productFilters.search);
  if (productFilters.category) params.set("cat", productFilters.category);
  if (productFilters.subcategory) params.set("sub", productFilters.subcategory);
  if (productFilters.minPrice) params.set("min", productFilters.minPrice);
  if (productFilters.maxPrice) params.set("max", productFilters.maxPrice);

  const query = params.toString();
  const nextURL = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  const currentURL = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextURL === currentURL) return;

  if (replace) {
    history.replaceState(null, "", nextURL);
    return;
  }

  history.pushState(null, "", nextURL);
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
 * Build a compact filter menu from product data.
 */
function initFilters(products) {
  const container = document.getElementById("category-filters");
  if (!container) return;

  container.innerHTML = `
    <details class="products-filter-menu">
      <summary class="products-filter-summary">
        <span>Filters</span>
        <span id="filter-count" class="products-filter-count"></span>
      </summary>
      <form class="products-filter-form" role="search">
        <label class="products-filter-field products-filter-field-wide" for="product-search">
          <span>Search</span>
          <input id="product-search" type="search" autocomplete="off" placeholder="Search by name">
        </label>

        <label class="products-filter-field" for="product-subcategory-filter">
          <span>Subcategory</span>
          <select id="product-subcategory-filter"></select>
        </label>

        <label class="products-filter-field products-filter-price" for="product-min-price">
          <span>Min price</span>
          <input id="product-min-price" type="number" min="0" inputmode="decimal" placeholder="0">
        </label>

        <label class="products-filter-field products-filter-price" for="product-max-price">
          <span>Max price</span>
          <input id="product-max-price" type="number" min="0" inputmode="decimal" placeholder="Any">
        </label>

        <button class="products-filter-reset" type="reset">Reset</button>
      </form>
    </details>
  `;

  setFilterMenuState(container.querySelector(".products-filter-menu"));

  const form = container.querySelector(".products-filter-form");
  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("reset", (event) => {
    event.preventDefault();
    window.clearTimeout(filterInputTimer);
    updateFilters({
      search: "",
      subcategory: "",
      minPrice: "",
      maxPrice: ""
    });
  });

  bindFilterInput(container, "product-search", "input", (value) => {
    window.clearTimeout(filterInputTimer);
    filterInputTimer = window.setTimeout(() => updateFilters({ search: value.trim() }), 140);
  });

  bindFilterInput(container, "product-subcategory-filter", "change", (value) => {
    updateFilters({ subcategory: value });
  });

  bindFilterInput(container, "product-min-price", "input", (value) => {
    window.clearTimeout(filterInputTimer);
    filterInputTimer = window.setTimeout(() => updateFilters({ minPrice: value }), 180);
  });

  bindFilterInput(container, "product-max-price", "input", (value) => {
    window.clearTimeout(filterInputTimer);
    filterInputTimer = window.setTimeout(() => updateFilters({ maxPrice: value }), 180);
  });

  syncFilterControls();
  window.initRevealOnScroll?.(container);
}

function setFilterMenuState(menu) {
  if (!menu) return;
  menu.open = false;
}

function bindFilterInput(container, id, eventName, handler) {
  const input = container.querySelector(`#${id}`);
  if (!input) return;
  input.addEventListener(eventName, () => handler(input.value));
}

function syncFilterControls() {
  const container = document.getElementById("category-filters");
  if (!container) return;

  setInputValue(container, "product-search", productFilters.search);
  setInputValue(container, "product-min-price", productFilters.minPrice);
  setInputValue(container, "product-max-price", productFilters.maxPrice);

  const subcategoryProducts = productFilters.category
    ? allProducts.filter((product) => product.categorySlug === productFilters.category)
    : allProducts;

  populateSelect(
    container.querySelector("#product-subcategory-filter"),
    uniqueOptions(subcategoryProducts, (product) => product.subcategorySlug, (product) => product.subcategory),
    "All subcategories",
    productFilters.subcategory
  );
}

function setInputValue(container, id, value) {
  const input = container.querySelector(`#${id}`);
  if (input && input.value !== value) input.value = value;
}

function populateSelect(select, options, allLabel, activeValue) {
  if (!select) return;

  const currentOptions = JSON.stringify([...select.options].map((option) => [option.value, option.textContent]));
  const nextOptions = JSON.stringify([["", allLabel], ...options.map((option) => [option.value, option.label])]);

  if (currentOptions !== nextOptions) {
    select.innerHTML = "";
    select.appendChild(new Option(allLabel, ""));
    options.forEach((option) => select.appendChild(new Option(option.label, option.value)));
  }

  select.value = options.some((option) => option.value === activeValue) ? activeValue : "";
  if (activeValue && select.value === "") {
    productFilters.subcategory = select.id === "product-subcategory-filter" ? "" : productFilters.subcategory;
  }
}

function uniqueOptions(products, valueGetter, labelGetter) {
  const seen = new Map();

  products.forEach((product) => {
    const value = valueGetter(product);
    const label = labelGetter(product);
    if (!value || !label || seen.has(value)) return;
    seen.set(value, label);
  });

  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function getProductPrice(product) {
  const rawPrice = product.price ?? product.priceFrom ?? product.startingPrice ?? product.basePrice ?? product.priceMin;
  if (rawPrice === undefined || rawPrice === null || rawPrice === "") return null;
  if (typeof rawPrice === "number") return Number.isFinite(rawPrice) ? rawPrice : null;

  const normalized = String(rawPrice).replace(/[^0-9.,-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function applyAndRenderFilters() {
  const search = productFilters.search.trim().toLowerCase();
  const minPrice = Number.parseFloat(productFilters.minPrice);
  const maxPrice = Number.parseFloat(productFilters.maxPrice);

  const filtered = allProducts.filter((product) => {
    const productPrice = getProductPrice(product);

    if (search && !product.name.toLowerCase().includes(search)) return false;
    if (productFilters.category && product.categorySlug !== productFilters.category) return false;
    if (productFilters.subcategory && product.subcategorySlug !== productFilters.subcategory) return false;
    if (Number.isFinite(minPrice) && (productPrice === null || productPrice < minPrice)) return false;
    if (Number.isFinite(maxPrice) && (productPrice === null || productPrice > maxPrice)) return false;

    return true;
  });

  renderProducts(filtered);
  updateFilterCount(filtered.length);
}

function updateFilterCount(count) {
  const countEl = document.getElementById("filter-count");
  if (!countEl) return;
  countEl.textContent = `${count} ${count === 1 ? "item" : "items"}`;
}

/**
 * Render product cards into the grid.
 */
function renderProducts(products) {
  const grid = document.getElementById("product-grid");
  if (!grid) return;

  grid.innerHTML = "";
  if (!products.length) {
    grid.innerHTML = '<div class="col-12 text-center py-4" style="color: var(--text-muted);">No products match these filters.</div>';
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
