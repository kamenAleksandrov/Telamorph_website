/* ==========================================================================
   Telamorph — Industrial listing (industrial.js)
   A focused catalogue: search + a responsive grid of product cards. Column
   count and page size scale with viewport so each page stays ~4 rows tall and
   smaller screens show fewer items (less scrolling). No category filters —
   every item shown is industrial.
   ========================================================================== */

const INDUSTRIAL_CATEGORY = "industrial-solutions";

// Page size tracks the grid's column count (see row-cols-* in industrial.html)
// so every page fills roughly the same number of rows:
//   ≥1200px → 4 cols × 4 rows = 16   |   ≥992px → 3 cols × 4 rows = 12
//    ≥576px → 2 cols × 4 rows =  8   |   < 576px → 1 col  × 6 rows =  6
function getItemsPerPage() {
  const w = window.innerWidth;
  if (w >= 1200) return 16;
  if (w >= 992) return 12;
  if (w >= 576) return 8;
  return 6;
}

let industrialAll = [];
let industrialFiltered = [];
let industrialPage = 1;
let industrialSearch = "";
let industrialSearchTimer = null;
let industrialPerPage = getItemsPerPage();
let industrialResizeTimer = null;

document.addEventListener("DOMContentLoaded", initIndustrialPage);

async function initIndustrialPage() {
  const grid = document.getElementById("industrial-grid");
  if (!grid) return;

  const products = await loadJSON("data/products.json");
  industrialAll = products.filter(
    (product) => product.categorySlug === INDUSTRIAL_CATEGORY,
  );
  industrialFiltered = industrialAll;

  bindIndustrialSearch();
  bindIndustrialResize();
  renderIndustrial();
}

// Recompute page size on resize; only re-render when the tier actually changes,
// keeping the viewer's first item visible across the layout switch.
function bindIndustrialResize() {
  window.addEventListener("resize", () => {
    window.clearTimeout(industrialResizeTimer);
    industrialResizeTimer = window.setTimeout(() => {
      const next = getItemsPerPage();
      if (next === industrialPerPage) return;
      const firstItem = (industrialPage - 1) * industrialPerPage;
      industrialPerPage = next;
      industrialPage = Math.floor(firstItem / industrialPerPage) + 1;
      renderIndustrial();
    }, 160);
  });
}

function bindIndustrialSearch() {
  const input = document.getElementById("industrial-search");
  if (!input) return;

  input.addEventListener("input", () => {
    window.clearTimeout(industrialSearchTimer);
    industrialSearchTimer = window.setTimeout(() => {
      industrialSearch = input.value.trim().toLowerCase();
      industrialPage = 1;
      applyIndustrialFilter();
      renderIndustrial();
    }, 140);
  });
}

function applyIndustrialFilter() {
  if (!industrialSearch) {
    industrialFiltered = industrialAll;
    return;
  }

  industrialFiltered = industrialAll.filter((product) => {
    const haystack = [
      product.name,
      product.shortDescription,
      product.subcategory,
      ...(product.keywords || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(industrialSearch);
  });
}

function renderIndustrial() {
  const grid = document.getElementById("industrial-grid");
  const empty = document.getElementById("industrial-empty");
  const count = document.getElementById("industrial-count");
  if (!grid) return;

  const total = industrialFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / industrialPerPage));
  industrialPage = Math.min(industrialPage, totalPages);

  if (count) {
    count.textContent = `${total} ${total === 1 ? "product" : "products"}`;
  }

  grid.innerHTML = "";

  if (!total) {
    if (empty) empty.style.display = "block";
    renderIndustrialPagination(0);
    return;
  }
  if (empty) empty.style.display = "none";

  const start = (industrialPage - 1) * industrialPerPage;
  const pageItems = industrialFiltered.slice(start, start + industrialPerPage);

  pageItems.forEach((product) => {
    const card = createProductCard(product);
    card.classList.add("reveal");
    grid.appendChild(card);
  });

  window.initCursorStreaks?.(grid);
  window.initRevealOnScroll?.(grid, { immediate: true });

  renderIndustrialPagination(totalPages);
}

function renderIndustrialPagination(totalPages) {
  const nav = document.getElementById("industrial-pagination");
  if (!nav) return;

  nav.innerHTML = "";
  if (totalPages <= 1) return;

  const makeButton = (
    label,
    page,
    { disabled = false, active = false } = {},
  ) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "industrial-page-btn";
    if (active) btn.classList.add("is-active");
    btn.textContent = label;
    btn.disabled = disabled;
    if (active) btn.setAttribute("aria-current", "page");
    if (!disabled && !active) {
      btn.addEventListener("click", () => goToIndustrialPage(page));
    }
    return btn;
  };

  nav.appendChild(
    makeButton("Prev", industrialPage - 1, { disabled: industrialPage === 1 }),
  );

  for (let page = 1; page <= totalPages; page += 1) {
    nav.appendChild(
      makeButton(String(page), page, { active: page === industrialPage }),
    );
  }

  nav.appendChild(
    makeButton("Next", industrialPage + 1, {
      disabled: industrialPage === totalPages,
    }),
  );
}

function goToIndustrialPage(page) {
  industrialPage = page;
  renderIndustrial();
  const catalog = document.querySelector(".industrial-catalog");
  if (catalog) {
    catalog.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
