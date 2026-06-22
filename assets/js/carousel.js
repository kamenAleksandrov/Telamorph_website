/* ==========================================================================
   Telamorph — Media carousel
   Crossfade, auto-advancing carousel for [data-carousel] media tiles. For each
   one it builds dot controls, advances on a timer, pauses on hover/focus and
   when offscreen, and honours prefers-reduced-motion (no autoplay; dots still
   switch slides). Progressive enhancement only — no JS leaves the first slide
   showing with no dots.
   ========================================================================== */

(function () {
  "use strict";

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const DEFAULT_INTERVAL = 5000;

  function initCarousel(root) {
    const slides = Array.from(
      root.querySelectorAll(":scope > [data-carousel-slide]"),
    );
    if (slides.length < 2) return; // nothing to rotate

    const interval =
      parseInt(root.dataset.carouselInterval, 10) || DEFAULT_INTERVAL;

    // Build dots
    const dotsWrap = document.createElement("div");
    dotsWrap.className = "media-carousel-dots";
    const dots = slides.map((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "media-carousel-dot";
      dot.setAttribute("aria-label", "Show image " + (i + 1));
      dot.addEventListener("click", () => {
        show(i);
        restart();
      });
      dotsWrap.appendChild(dot);
      return dot;
    });
    root.appendChild(dotsWrap);

    let index = slides.findIndex((s) => s.classList.contains("is-active"));
    if (index < 0) index = 0;

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach((s, n) => s.classList.toggle("is-active", n === index));
      dots.forEach((d, n) => {
        const active = n === index;
        d.classList.toggle("is-active", active);
        if (active) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
    }
    show(index);

    let timer = null;
    const advance = () => show(index + 1);
    function start() {
      if (reduceMotion || timer) return;
      timer = setInterval(advance, interval);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    function restart() {
      stop();
      start();
    }

    // Pause while the user is interacting with the tile
    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", start);

    // Only run while on screen
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) start();
            else stop();
          }
        },
        { threshold: 0.15 },
      );
      io.observe(root);
    } else {
      start();
    }
  }

  function init() {
    document.querySelectorAll("[data-carousel]").forEach(initCarousel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
