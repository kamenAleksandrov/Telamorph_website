/* ==========================================================================
   Telamorph — Main JS (runs on every page)
   Loads nav + footer partials, handles active-link highlighting
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadNav(), loadFooter()]);
  highlightActiveTab();
  initCursorStreaks();
  initRevealOnScroll();
  warmProductDataCache();
});

const shellCacheKeys = {
  nav: "telamorph-shell-nav-v2",
  footer: "telamorph-shell-footer-v1"
};

const shellPartialUrls = {
  nav: "components/nav.html?v=20260429-devprod",
  footer: "components/footer.html?v=20260429-devprod"
};

function readShellCache(cacheKey) {
  try {
    return sessionStorage.getItem(cacheKey) || "";
  } catch {
    return "";
  }
}

function writeShellCache(cacheKey, html) {
  try {
    sessionStorage.setItem(cacheKey, html);
  } catch {
    // Ignore storage failures in private or restricted browsing modes.
  }
}

function hydratePartialFromCache(target, cacheKey) {
  const cachedHTML = readShellCache(cacheKey);
  if (cachedHTML && !target.innerHTML.trim()) {
    target.innerHTML = cachedHTML;
    target.dataset.shellHydrated = "true";
  }
  return cachedHTML;
}

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
  const cachedHTML = hydratePartialFromCache(target, shellCacheKeys.nav);
  try {
    const res = await fetch(shellPartialUrls.nav);
    if (!res.ok) throw new Error(`Nav load failed: ${res.status}`);
    const html = sanitizePartial(await res.text()).trim();
    if (!html) return;
    if (html !== cachedHTML) {
      target.innerHTML = html;
    }
    target.dataset.shellHydrated = "true";
    writeShellCache(shellCacheKeys.nav, html);
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
  const cachedHTML = hydratePartialFromCache(target, shellCacheKeys.footer);
  try {
    const res = await fetch(shellPartialUrls.footer);
    if (!res.ok) throw new Error(`Footer load failed: ${res.status}`);
    const html = sanitizePartial(await res.text()).trim();
    if (!html) return;
    if (html !== cachedHTML) {
      target.innerHTML = html;
    }
    target.dataset.shellHydrated = "true";
    writeShellCache(shellCacheKeys.footer, html);
  } catch (err) {
    console.error(err);
  }
}

function warmProductDataCache() {
  if (typeof prefetchJSON !== "function") return;
  prefetchJSON("data/products.json");
}

const cursorStreakSelector = [
  ".footer-contact",
  ".product-tabs",
  ".product-tab",
  ".footer-links a",
  ".menu-list li a",
  ".showcase-band",
  ".value-card",
  ".service-step",
  ".service-card",
  ".quote-list",
  ".sphere-card",
  ".sphere-panel",
  ".workflow-step",
  ".quote-panel",
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
 * Fade + float-up each .reveal element when it scrolls into view.
 * Elements inside .reveal-stagger groups stagger by sibling index.
 * Dense card groups reveal together so high-index cards do not feel delayed.
 * Idempotent and accepts a root so dynamically rendered content can opt in.
 */
let revealObserver = null;

function initRevealOnScroll(root = document) {
  const matches = (el, sel) => typeof el?.matches === "function" && el.matches(sel);

  if (!("IntersectionObserver" in window)) {
    if (matches(root, ".reveal")) root.classList.add("is-visible");
    root.querySelectorAll?.(".reveal").forEach((el) => el.classList.add("is-visible"));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px 10% 0px" }
    );
  }

  const groups = [];
  if (matches(root, ".reveal-stagger")) groups.push(root);
  groups.push(...(root.querySelectorAll?.(".reveal-stagger") || []));
  groups.forEach((group) => {
    const revealItems = [...group.querySelectorAll(":scope > .reveal")];
    const cardSelector = [
      ".value-card",
      ".showcase-band",
      ".product-card",
      ".service-step",
      ".service-card",
      ".quote-list",
      ".sphere-card",
      ".sphere-panel",
      ".workflow-step",
      ".quote-panel"
    ].join(", ");
    const isCardGroup = revealItems.length > 1 && revealItems.every((el) => {
      return el.matches(cardSelector) || Boolean(el.querySelector(cardSelector));
    });

    revealItems.forEach((el, i) => {
      el.style.transitionDelay = isCardGroup ? "0ms" : `${Math.min(i * 70, 210)}ms`;
    });
  });

  const items = [];
  if (matches(root, ".reveal")) items.push(root);
  items.push(...(root.querySelectorAll?.(".reveal") || []));
  items.forEach((el) => {
    if (el.dataset.revealReady) return;
    el.dataset.revealReady = "true";
    revealObserver.observe(el);
  });
}

window.initRevealOnScroll = initRevealOnScroll;

/**
 * Highlight the active product-tab if on products page with ?cat= param.
 */
function highlightActiveTab() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  const cat = new URLSearchParams(window.location.search).get("cat");

  const serviceTabByPage = {
    "body-kits.html": "body-kits.html",
    "development-production.html": "development-production.html"
  };

  if (serviceTabByPage[page]) {
    document.querySelector(`.product-tab[href="${serviceTabByPage[page]}"]`)?.classList.add("active");
    return;
  }

  if (page === "products.html" && cat) {
    document.querySelectorAll(".product-tab").forEach(tab => {
      if (tab.getAttribute("data-category") === cat) {
        tab.classList.add("active");
      }
    });
  }
}
