/* ==========================================================================
   Telamorph — Main JS (runs on every page)
   Loads nav + footer partials, handles active-link highlighting
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadNav(), loadFooter()]);
  highlightActiveTab();
  initCursorStreaks();
  initNavStreakReset();
  // In deck mode (deck.js) reveals and the scroll-to-top button are driven by
  // the deck controller, since there is no document scroll to observe.
  if (!window.__deckEnabled) {
    initHeroReveal();
    initRevealOnScroll();
    initScrollTopButton();
  }
  warmProductDataCache();
});

const shellCacheKeys = {
  nav: "telamorph-shell-nav-v4",
  footer: "telamorph-shell-footer-v2",
};

const shellPartialUrls = {
  nav: "components/nav.html?v=20260707-brandmark",
  footer: "components/footer.html?v=20260622-partner",
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
  ".navbar-telamorph",
  ".product-tab",
  ".pd-tab-nav",
  ".pd-tab-btn",
  ".footer-links a",
  ".footer-contact-value",
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
  ".btn-outline-accent",
  ".svc-chip",
  ".svc-catch",
  ".cd-catch",
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
 * When the offcanvas menu closes, drop the navbar's frozen streak position.
 * Bootstrap restores focus to the hamburger on close; paired with the
 * `:has(:focus-visible)` rule this keeps the streak from lingering, and resets
 * its position for the keyboard (Escape) close path.
 */
function initNavStreakReset() {
  const menu = document.getElementById("sideMenu");
  const navbar = document.querySelector(".navbar-telamorph");
  if (!menu || !navbar) return;
  menu.addEventListener("hidden.bs.offcanvas", () => {
    navbar.style.removeProperty("--streak-x");
    navbar.style.removeProperty("--streak-y");
  });
}

/**
 * Reveal the hero's .reveal elements (heading, lead, actions, scroll cue)
 * immediately on load instead of waiting for the scroll observer. The hero
 * fills the viewport, so its bottom-anchored elements (especially the scroll
 * cue) sit right at the edge of the observer's rootMargin and may not cross
 * the intersection threshold until the user scrolls.
 */
function initHeroReveal() {
  const heroItems = document.querySelectorAll(".hero .reveal");
  if (!heroItems.length) return;

  heroItems.forEach((el) => {
    el.dataset.revealReady = "true";
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      heroItems.forEach((el) => {
        if (el.matches(".hero-scroll-cue")) {
          // Trail slightly behind the staggered hero text.
          setTimeout(() => el.classList.add("is-visible"), 250);
        } else {
          el.classList.add("is-visible");
        }
      });
    });
  });
}

/**
 * Fade + float-up each .reveal element when it scrolls into view.
 * Elements inside .reveal-stagger groups stagger by sibling index.
 * Dense card groups reveal together so high-index cards do not feel delayed.
 * Idempotent and accepts a root so dynamically rendered content can opt in.
 */
let revealObserver = null;

function initRevealOnScroll(root = document) {
  const matches = (el, sel) =>
    typeof el?.matches === "function" && el.matches(sel);

  if (!("IntersectionObserver" in window)) {
    if (matches(root, ".reveal")) root.classList.add("is-visible");
    root
      .querySelectorAll?.(".reveal")
      .forEach((el) => el.classList.add("is-visible"));
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
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
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
      ".quote-panel",
    ].join(", ");
    const isCardGroup =
      revealItems.length > 1 &&
      revealItems.every((el) => {
        return (
          el.matches(cardSelector) || Boolean(el.querySelector(cardSelector))
        );
      });

    revealItems.forEach((el, i) => {
      el.style.transitionDelay = isCardGroup
        ? "0ms"
        : `${Math.min(i * 70, 210)}ms`;
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
 * Inject a floating "scroll to top" button. The transparent navbar scrolls
 * away with the page, so this is the persistent way back up. The button fades
 * in once the user has scrolled roughly one viewport down.
 */
function initScrollTopButton() {
  if (document.querySelector(".scroll-top")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "scroll-top";
  btn.setAttribute("aria-label", "Scroll back to top");
  btn.innerHTML =
    '<span class="icon-cycle icon-cycle--up" aria-hidden="true"></span>';
  document.body.appendChild(btn);

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  let ticking = false;
  const root = document.documentElement;
  const update = () => {
    btn.classList.toggle(
      "is-visible",
      window.scrollY > window.innerHeight * 0.6,
    );
    // Fade in the scrim behind the fixed logo as soon as the page moves, so
    // the mark stays legible over whatever scrolls beneath it (navbar.css).
    root.classList.toggle("nav-scrolled", window.scrollY > 8);
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
}

/**
 * Highlight the active product-tab for the current service page.
 */
function highlightActiveTab() {
  const page = window.location.pathname.split("/").pop() || "index.html";

  const servicePages = [
    "composite-development.html",
    "manufacturing.html",
    "industrial.html",
  ];

  if (servicePages.includes(page)) {
    document
      .querySelector(`.product-tab[href="${page}"]`)
      ?.classList.add("active");
  }
}
