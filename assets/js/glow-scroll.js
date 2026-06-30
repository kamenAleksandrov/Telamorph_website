/* Scroll-driven ambient glow for the Manufacturing page.

   The glow layer (glow.css, body::after) is fixed to the viewport. Here we
   slide its blobs vertically as the page scrolls, so the glow appears to
   travel down through the dark .svc-step bands (the lighter .svc-step--alt
   bands are opaque and cover it). Position is mapped straight from scroll
   progress and updated every frame — glow.css's 1.1s page-nav transition is
   disabled for this page (see the inline :root override in manufacturing.html)
   so the glow tracks the scroll instead of lagging behind it.

   Falls back to the static seeded position under reduced-motion. */
(() => {
  const root = document.documentElement;

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Vertical travel range (% of viewport) for each blob across the full
  // scroll. Blob B trails A so the pair reads as one glow drifting down.
  const A_FROM = 16,
    A_TO = 84;
  const B_FROM = 28,
    B_TO = 96;

  let ticking = false;

  function update() {
    ticking = false;
    const scrollable =
      document.documentElement.scrollHeight - window.innerHeight;
    let p = scrollable > 0 ? window.scrollY / scrollable : 0;
    if (p < 0) p = 0;
    else if (p > 1) p = 1;

    root.style.setProperty("--glow-a-y", (A_FROM + p * (A_TO - A_FROM)).toFixed(1) + "%");
    root.style.setProperty("--glow-b-y", (B_FROM + p * (B_TO - B_FROM)).toFixed(1) + "%");
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
})();
