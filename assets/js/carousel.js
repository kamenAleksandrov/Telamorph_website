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
  const FIRST_DELAY = 2500; // quicker first advance so it doesn't feel stalled

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

    // The timer is a self-rescheduling setTimeout (not setInterval) so a pause
    // can preserve how much of the current slide's time is left: hovering or
    // focusing the tile freezes the countdown and leaving resumes it, rather
    // than restarting the full wait. The first advance uses the shorter
    // FIRST_DELAY; every advance after that uses the configured interval.
    let timer = null;
    let tickStart = 0; // when the current countdown began
    let remaining = Math.min(FIRST_DELAY, interval); // ms left on this slide

    function clearTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    // Begin or resume counting down the time left on the current slide.
    function play() {
      if (reduceMotion || timer) return;
      tickStart = Date.now();
      timer = setTimeout(() => {
        timer = null;
        remaining = interval; // later slides use the full interval
        show(index + 1);
        play();
      }, remaining);
    }
    // Freeze the countdown, keeping the remaining time for the next resume.
    function pause() {
      if (!timer) return;
      remaining = Math.max(0, remaining - (Date.now() - tickStart));
      clearTimer();
    }
    // Reset to a full interval and start over (used after a manual dot jump).
    function restart() {
      clearTimer();
      remaining = interval;
      play();
    }

    // Pause (not reset) while the user is hovering or focused on the tile.
    root.addEventListener("mouseenter", pause);
    root.addEventListener("mouseleave", play);
    root.addEventListener("focusin", pause);
    root.addEventListener("focusout", play);

    // Only run while on screen
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) play();
            else pause();
          }
        },
        { threshold: 0.15 },
      );
      io.observe(root);
    } else {
      play();
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
