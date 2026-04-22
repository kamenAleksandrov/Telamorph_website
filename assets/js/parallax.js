/* ==========================================================================
   Telamorph — Parallax scroll effect
   Moves .parallax-bg elements at a slower rate than normal scroll
   ========================================================================== */

(function () {
  "use strict";

  // Maximum portion of the parent's height that the bg can shift.
  // Must be <= the CSS overshoot (inset: -10% 0  →  0.10).
  const MAX_SHIFT_RATIO = 0.10;

  let parallaxElements = [];
  let ticking = false;

  function init() {
    parallaxElements = Array.from(document.querySelectorAll(".parallax-bg"));
    if (!parallaxElements.length) return;

    // Skip on devices that typically struggle with scroll transforms
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updatePositions);
    }
  }

  function updatePositions() {
    const viewportH = window.innerHeight;

    for (const el of parallaxElements) {
      const parent = el.parentElement;
      const rect = parent.getBoundingClientRect();

      // Only update elements that are in or near the viewport
      if (rect.bottom < -viewportH || rect.top > viewportH * 2) continue;

      // Progress: -1 when parent is fully below viewport,
      //          0 when parent center matches viewport center,
      //          +1 when parent is fully above viewport.
      const center = rect.top + rect.height / 2;
      const range = (viewportH + rect.height) / 2;
      let progress = (center - viewportH / 2) / range;
      if (progress < -1) progress = -1;
      if (progress > 1) progress = 1;

      // Shift bounded to ±(rect.height * MAX_SHIFT_RATIO),
      // guaranteeing the bg always covers its parent.
      const offset = -progress * rect.height * MAX_SHIFT_RATIO;

      el.style.transform = "translate3d(0," + offset.toFixed(2) + "px,0)";
    }

    ticking = false;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
