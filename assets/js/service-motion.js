/* ==========================================================================
   Telamorph — Service page motion (Manufacturing)
   A quiet, scroll-linked vertical parallax drift on each step photo inside
   its frame — reinforces depth without scroll-jacking. Progressive
   enhancement: with no JS the page is a normal static read; skipped entirely
   when the user prefers reduced motion.
   ========================================================================== */

(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const mediaBgs = Array.from(document.querySelectorAll(".svc-media-bg"));
  if (!mediaBgs.length) return;

  const DRIFT = 4; // max drift as a % of frame height (must stay < scale overshoot)

  let ticking = false;
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  function update() {
    ticking = false;
    const vh = window.innerHeight;
    for (const bg of mediaBgs) {
      const frame = bg.parentElement;
      const rect = frame.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) continue;
      const center = rect.top + rect.height / 2;
      let prog = (center - vh / 2) / ((vh + rect.height) / 2); // -1 (below) .. +1 (above)
      if (prog < -1) prog = -1;
      else if (prog > 1) prog = 1;
      bg.style.setProperty("--svc-shift", (-prog * DRIFT).toFixed(2) + "%");
    }
  }

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  window.addEventListener("load", onScroll); // re-measure once images settle
})();
