/* ==========================================================================
   Telamorph — Main JS (runs on every page)
   Loads nav + footer partials, handles active-link highlighting
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadNav(), loadFooter()]);
  highlightActiveTab();
});

/**
 * Fetch and inject the navigation partial.
 */
async function loadNav() {
  const target = document.getElementById("nav-placeholder");
  if (!target) return;
  try {
    const res = await fetch("components/nav.html");
    if (!res.ok) throw new Error(`Nav load failed: ${res.status}`);
    target.innerHTML = await res.text();
  } catch (err) {
    console.error(err);
  }
}

/**
 * Fetch and inject the footer partial.
 */
async function loadFooter() {
  const target = document.getElementById("footer-placeholder");
  if (!target) return;
  try {
    const res = await fetch("components/footer.html");
    if (!res.ok) throw new Error(`Footer load failed: ${res.status}`);
    target.innerHTML = await res.text();
  } catch (err) {
    console.error(err);
  }
}

/**
 * Highlight the active product-tab if on products page with ?cat= param.
 */
function highlightActiveTab() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  const cat = new URLSearchParams(window.location.search).get("cat");

  if (page === "products.html" && cat) {
    document.querySelectorAll(".product-tab").forEach(tab => {
      if (tab.getAttribute("data-category") === cat) {
        tab.classList.add("active");
      }
    });
  }
}
