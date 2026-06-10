/* ==========================================================================
   Telamorph — Home middle-section scroll fade
   The landing page scrolls normally (no deck). The approach rows in the middle
   gently brighten as they pass through the vertical centre of the viewport and
   dim (not vanish) as they move away — keeping their two-column layout fixed.
   Pure progressive enhancement: without JS the rows are simply fully visible.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const els = Array.from(document.querySelectorAll(".scroll-fade"));
  if (!els.length) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    els.forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    return;
  }

  // --- Tunables ---------------------------------------------------------------
  // Distance is |centreRatio - 0.5|, where centreRatio is the element's centre
  // as a fraction of viewport height (0 = top edge, 0.5 = middle, 1 = bottom).
  const FULL = 0.12; // within this of centre → fully bright (smaller = fades earlier)
  const FADE = 0.45; // at/beyond this → dimmest
  const MIN = 0.32; // dimmest opacity (kept > 0 so content never fully vanishes)
  const SHIFT = 10; // px of subtle drift toward centre (set 0 to disable movement)
  // ---------------------------------------------------------------------------

  let ticking = false;

  const update = () => {
    ticking = false;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const centreRatio = (rect.top + rect.height / 2) / vh;
      const d = Math.abs(centreRatio - 0.5);

      let opacity;
      if (d <= FULL) {
        opacity = 1;
      } else if (d >= FADE) {
        opacity = MIN;
      } else {
        const t = (d - FULL) / (FADE - FULL);
        const eased = t * t * (3 - 2 * t); // smoothstep
        opacity = 1 - (1 - MIN) * eased;
      }

      el.style.opacity = opacity.toFixed(3);

      if (SHIFT) {
        const dir = centreRatio > 0.5 ? 1 : -1; // below centre drifts down, above drifts up
        const amt = Math.min(d, FADE) / FADE; // 0 at centre → 1 at the edges
        el.style.transform = `translate3d(0, ${(dir * amt * SHIFT).toFixed(1)}px, 0)`;
      }
    });
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
});
