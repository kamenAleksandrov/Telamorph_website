/* ==========================================================================
   Telamorph — Media fit-to-image
   Sizes a [data-fit] media container's aspect-ratio to the image it is
   currently showing, clamped to a min/max ratio, and lets CSS animate the
   change (transition: aspect-ratio). Within the limits the box matches the
   image exactly (no bars, no crop); beyond them the image falls back to a
   cover crop. Works with the crossfade carousel and the composite scrolly
   panel via a MutationObserver on `.is-active`, so there is no coupling to
   those controllers. Background-image based only. Progressive enhancement:
   with no JS the container keeps its CSS-default ratio.
   ========================================================================== */

(function () {
  "use strict";

  const DEFAULT_MIN = 0.6; // tallest allowed box (~2:3 portrait)
  const DEFAULT_MAX = 2.5; // widest allowed box

  function urlFrom(el) {
    const bg = el.style && el.style.backgroundImage;
    if (!bg) return null;
    const m = bg.match(/url\(\s*["']?(.*?)["']?\s*\)/);
    return m ? m[1] : null;
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Every element inside the container that carries an inline background image
  // (carousel slides, scrolly stage layers, or the container itself).
  function measurable(container) {
    const els = [container, ...container.querySelectorAll("*")];
    return els.filter(urlFrom);
  }

  // The image element that is actually visible right now.
  function activeLeaf(container) {
    const stage = container.querySelector(".cd-stage-img.is-active");
    const scope = stage || container;
    const innerActive = scope.querySelector("[data-carousel-slide].is-active");
    if (innerActive && innerActive.dataset.ratio) return innerActive;
    if (stage && stage.dataset.ratio) return stage;
    if (container.dataset.ratio) return container; // container holds the bg
    return Array.from(container.children).find((c) => c.dataset.ratio) || null;
  }

  function apply(container) {
    const leaf = activeLeaf(container);
    if (leaf && leaf.dataset.ratio) {
      container.style.setProperty("--media-ratio", leaf.dataset.ratio);
    }
  }

  function initContainer(container) {
    const min = parseFloat(container.dataset.fitMin) || DEFAULT_MIN;
    const max = parseFloat(container.dataset.fitMax) || DEFAULT_MAX;
    const els = measurable(container);
    if (!els.length) return;

    let pending = els.length;
    const done = () => {
      if (--pending === 0) apply(container);
    };

    els.forEach((el) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          el.dataset.ratio = clamp(
            img.naturalWidth / img.naturalHeight,
            min,
            max,
          ).toFixed(4);
        }
        done();
      };
      img.onerror = done;
      img.src = urlFrom(el);
    });

    // Re-apply whenever a slide/stage becomes active (carousel + scrolly). One
    // subtree observer catches every `.is-active` toggle inside, including the
    // stage-4 layer that has no image of its own. apply() only writes a style
    // property, so it never re-triggers this observer.
    const observer = new MutationObserver(() => apply(container));
    observer.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  function init() {
    document.querySelectorAll("[data-fit]").forEach(initContainer);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
