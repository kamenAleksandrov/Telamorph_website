/* ==========================================================================
   Telamorph — Main JS (runs on every page)
   Loads nav + footer partials, handles active-link highlighting
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadNav(), loadFooter()]);
  highlightActiveTab();
  initCursorStreaks();
});

/**
 * Strip dev-server injected scripts (e.g. Live Server hot-reload)
 * from a partial HTML string before inserting it into the DOM.
 */
function sanitizePartial(html) {
  return html
    .replace(/<!--\s*Code injected by live-server\s*-->/gi, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

/**
 * Fetch and inject the navigation partial.
 */
async function loadNav() {
  const target = document.getElementById("nav-placeholder");
  if (!target) return;
  try {
    const res = await fetch("components/nav.html");
    if (!res.ok) throw new Error(`Nav load failed: ${res.status}`);
    target.innerHTML = sanitizePartial(await res.text());
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
    target.innerHTML = sanitizePartial(await res.text());
  } catch (err) {
    console.error(err);
  }
}

const cursorStreakSelector = [
  ".footer-contact",
  ".product-tab",
  ".footer-links a",
  ".menu-list li a",
  ".showcase-band",
  ".value-card",
  ".product-card",
  ".btn-accent",
  ".btn-outline-accent"
].join(", ");

/**
 * Attach the cursor-tracked streak effect within a root element.
 * Safe to call again after dynamic content renders.
 */
function initCursorStreaks(root = document) {
  const elements = [];
  if (root.matches?.(cursorStreakSelector)) elements.push(root);
  elements.push(...root.querySelectorAll(cursorStreakSelector));

  elements.forEach((element) => {
    if (element.dataset.cursorStreakReady) return;
    element.dataset.cursorStreakReady = "true";

    element.addEventListener("pointermove", (e) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      element.style.setProperty("--streak-x", `${x}%`);
      element.style.setProperty("--streak-y", `${y}%`);
    });

    element.addEventListener("pointerleave", () => {
      element.style.removeProperty("--streak-x");
      element.style.removeProperty("--streak-y");
    });
  });
}

window.initCursorStreaks = initCursorStreaks;

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
