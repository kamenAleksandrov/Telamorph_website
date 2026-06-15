/* ==========================================================================
   Telamorph — Industrial listing (industrial.js)
   A focused catalogue: search + a 3-across grid of product cards, paginated
   at 12 (3 × 4) per page. No category filters — every item shown is industrial.
   ========================================================================== */

const INDUSTRIAL_CATEGORY = "industrial-solutions";
const ITEMS_PER_PAGE = 12; // 3 columns × 4 rows

let industrialAll = [];
let industrialFiltered = [];
let industrialPage = 1;
let industrialSearch = "";
let industrialSearchTimer = null;

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
  renderIndustrial();
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
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
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

  const start = (industrialPage - 1) * ITEMS_PER_PAGE;
  const pageItems = industrialFiltered.slice(start, start + ITEMS_PER_PAGE);

  pageItems.forEach((product) => {
    const card = createProductCard(product);
    card.classList.add("reveal");
    grid.appendChild(card);
  });

  window.initCursorStreaks?.(grid);
  window.initRevealOnScroll?.(grid);

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
