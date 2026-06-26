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

    // Prev/next arrows — revealed on hover/focus by CSS for precise pointers;
    // hidden outright on touch, where swipe (below) is the navigation path.
    function makeArrow(direction, label) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "media-carousel-arrow media-carousel-arrow--" + direction;
      btn.setAttribute("aria-label", label);
      const icon = document.createElement("span");
      icon.className =
        direction === "prev" ? "icon-cycle icon-cycle--left" : "icon-cycle";
      icon.setAttribute("aria-hidden", "true");
      btn.appendChild(icon);
      root.appendChild(btn);
      return btn;
    }
    const prevBtn = makeArrow("prev", "Previous image");
    const nextBtn = makeArrow("next", "Next image");
    prevBtn.addEventListener("click", () => {
      show(index - 1);
      restart();
    });
    nextBtn.addEventListener("click", () => {
      show(index + 1);
      restart();
    });

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

    // Swipe (touch): horizontal drag past the threshold advances/retreats.
    // Listeners are passive (no preventDefault) so vertical page scroll is
    // never hijacked — a diagonal gesture can scroll the page and change the
    // slide at the same time, which is the expected trade-off here.
    const SWIPE_THRESHOLD = 40; // px
    let touchStartX = null;
    let touchDeltaX = 0;

    root.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchDeltaX = 0;
        pause();
      },
      { passive: true },
    );
    root.addEventListener(
      "touchmove",
      (e) => {
        if (touchStartX === null) return;
        touchDeltaX = e.touches[0].clientX - touchStartX;
      },
      { passive: true },
    );
    root.addEventListener("touchend", () => {
      if (touchStartX === null) return;
      if (Math.abs(touchDeltaX) > SWIPE_THRESHOLD) {
        show(index + (touchDeltaX < 0 ? 1 : -1));
      }
      touchStartX = null;
      restart();
    });

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
