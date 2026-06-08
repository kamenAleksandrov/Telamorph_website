/* ==========================================================================
   Telamorph — Scene deck (full-page scroll)
   One gesture = one "stop". Top-level panels slide vertically; the stage's
   sub-slides cross-fade in place. Progressive enhancement: if disabled, the
   page is left as a normal scrolling document.
   ========================================================================== */

/* Decide synchronously (before DOMContentLoaded) so main.js / parallax.js can
   see the flag and stand down where needed. */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.__deckEnabled = !reduceMotion;
  if (window.__deckEnabled) {
    document.documentElement.classList.add("deck-enabled");
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  if (!window.__deckEnabled) return;

  const deck = document.getElementById("deck");
  const track = document.getElementById("deckTrack");
  if (!deck || !track) return;

  const SLIDE_MS = 950;
  const FADE_MS = 700;
  const WHEEL_MIN = 8;
  const SWIPE_MIN = 45;

  const panels = Array.from(track.children).filter((el) =>
    el.classList.contains("deck-panel")
  );
  if (!panels.length) return;

  const stageIndex = panels.findIndex((p) => p.classList.contains("deck-stage"));
  const footerIndex = panels.findIndex((p) => p.classList.contains("deck-footer"));
  const stageSlides =
    stageIndex >= 0
      ? Array.from(panels[stageIndex].querySelectorAll(".stage-slide"))
      : [];

  // Flatten panels into ordered stops.
  const stops = [];
  panels.forEach((panel, pi) => {
    if (pi === stageIndex && stageSlides.length) {
      stageSlides.forEach((_, si) => stops.push({ panel: pi, sub: si }));
    } else {
      stops.push({ panel: pi, sub: null });
    }
  });

  let current = 0;
  let locked = false;

  // How each stage sub-slide enters (its gap with the previous slide):
  // "horizontal" → slides in from the side, "vertical" → slides up from below,
  // "fade" (default) → cross-fades in place.
  const enterOf = (i) => (stageSlides[i]?.dataset.enter || "fade").toLowerCase();

  // --- Reveal-on-activate (the scroll observer is disabled in deck mode) ---
  function revealWithin(scope) {
    if (!scope) return;
    scope.querySelectorAll(".reveal-stagger").forEach((group) => {
      Array.from(group.querySelectorAll(":scope > .reveal")).forEach((el, i) => {
        el.style.transitionDelay = `${Math.min(i * 90, 270)}ms`;
      });
    });
    const items = [];
    if (scope.matches?.(".reveal")) items.push(scope);
    items.push(...scope.querySelectorAll(".reveal"));
    items.forEach((el) => el.classList.add("is-visible"));
  }

  function revealStop() {
    const stop = stops[current];
    const scope =
      stop.panel === stageIndex ? stageSlides[stop.sub] : panels[stop.panel];
    revealWithin(scope);
  }

  // --- Stage sub-slide positioning ---
  // Each slide's parked spot depends only on its own gaps, so non-adjacent
  // slides never move — only the two slides in a given step animate. A slide
  // waiting on the "next" side sits offscreen per its own enter direction; a
  // slide that has left sits offscreen per the next slide's enter direction.
  function placeStageSlides() {
    if (!stageSlides.length) return;
    const stop = stops[current];
    let sub;
    if (stop.panel === stageIndex) sub = stop.sub;
    else if (stop.panel < stageIndex) sub = 0; // entering from the top → first
    else sub = stageSlides.length - 1; // entering from the bottom → last

    stageSlides.forEach((slide, i) => {
      const d = i - sub;
      let transform = "none";
      let opacity = "0";
      let visible = false;

      if (d === 0) {
        opacity = "1";
        visible = true;
      } else if (d > 0) {
        const g = enterOf(i); // how this slide will arrive
        if (g === "horizontal") transform = "translateX(100%)";
        else if (g === "vertical") transform = "translateY(100%)";
        opacity = d === 1 && g !== "fade" ? "1" : "0";
        visible = d === 1;
      } else {
        const g = enterOf(i + 1); // how this slide left (next slide's gap)
        if (g === "horizontal") transform = "translateX(-100%)";
        else if (g === "vertical") transform = "translateY(-100%)";
        opacity = d === -1 && g !== "fade" ? "1" : "0";
        visible = d === -1;
      }

      slide.style.transform = transform;
      slide.style.opacity = opacity;
      slide.style.visibility = visible ? "visible" : "hidden";
      slide.style.pointerEvents = d === 0 ? "auto" : "none";
      slide.classList.toggle("is-current", d === 0);
    });
  }

  // --- Render ---
  function render() {
    const stop = stops[current];
    track.style.transform = `translate3d(0, ${-stop.panel * 100}%, 0)`;
    placeStageSlides();
    updateChrome();
  }

  function goTo(index) {
    const next = Math.max(0, Math.min(stops.length - 1, index));
    if (next === current || locked) return;
    const from = stops[current];
    const to = stops[next];
    const samePanel = to.panel === from.panel;
    // Sliding sub-slides take as long as a panel step; fades are quicker.
    let lockMs = SLIDE_MS;
    if (samePanel && from.panel === stageIndex) {
      lockMs = enterOf(Math.max(from.sub, to.sub)) === "fade" ? FADE_MS : SLIDE_MS;
    }
    current = next;
    locked = true;
    render();
    revealStop();
    window.setTimeout(() => {
      locked = false;
    }, lockMs);
  }

  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  // --- Footer internal scroll (release scroll-jacking while it can scroll) ---
  function footerCanScroll(delta) {
    if (stops[current].panel !== footerIndex || footerIndex < 0) return false;
    const fp = panels[footerIndex];
    const atTop = fp.scrollTop <= 0;
    const atBottom = fp.scrollTop + fp.clientHeight >= fp.scrollHeight - 1;
    if (delta > 0 && !atBottom) return true;
    if (delta < 0 && !atTop) return true;
    return false;
  }

  // --- Wheel ---
  deck.addEventListener(
    "wheel",
    (e) => {
      if (footerCanScroll(e.deltaY)) return; // let the footer scroll natively
      e.preventDefault();
      if (locked || Math.abs(e.deltaY) < WHEEL_MIN) return;
      e.deltaY > 0 ? next() : prev();
    },
    { passive: false }
  );

  // --- Touch (swipe) ---
  let touchY = null;
  deck.addEventListener(
    "touchstart",
    (e) => {
      touchY = e.touches[0].clientY;
    },
    { passive: true }
  );
  deck.addEventListener(
    "touchmove",
    (e) => {
      if (touchY === null) return;
      const dy = touchY - e.touches[0].clientY; // +ve = swipe up = next
      if (footerCanScroll(dy)) return;
      e.preventDefault();
      if (locked || Math.abs(dy) < SWIPE_MIN) return;
      dy > 0 ? next() : prev();
      touchY = null; // one step per swipe
    },
    { passive: false }
  );
  deck.addEventListener("touchend", () => {
    touchY = null;
  });

  // --- Keyboard ---
  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    // Don't hijack typing or activating a focused control (Space/Enter on it).
    if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(tag)) return;
    switch (e.key) {
      case "ArrowDown":
      case "PageDown":
      case " ":
        e.preventDefault();
        next();
        break;
      case "ArrowUp":
      case "PageUp":
        e.preventDefault();
        prev();
        break;
      case "Home":
        e.preventDefault();
        goTo(0);
        break;
      case "End":
        e.preventDefault();
        goTo(stops.length - 1);
        break;
      default:
        break;
    }
  });

  // --- In-page anchors jump to the matching stop ---
  function stopIndexForElement(el) {
    const panel = el.closest(".deck-panel");
    if (!panel) return -1;
    const pi = panels.indexOf(panel);
    if (pi < 0) return -1;
    if (pi === stageIndex) {
      const slide = el.closest(".stage-slide");
      const si = slide ? stageSlides.indexOf(slide) : 0;
      return stops.findIndex((s) => s.panel === pi && s.sub === si);
    }
    return stops.findIndex((s) => s.panel === pi);
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    const idx = stopIndexForElement(target);
    if (idx < 0) return;
    e.preventDefault();
    goTo(idx);
  });

  // --- Chrome: scroll-to-top button + side dots ---
  const scrollTopBtn = document.createElement("button");
  scrollTopBtn.type = "button";
  scrollTopBtn.className = "scroll-top";
  scrollTopBtn.setAttribute("aria-label", "Back to top");
  scrollTopBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  scrollTopBtn.addEventListener("click", () => goTo(0));
  document.body.appendChild(scrollTopBtn);

  const dotsWrap = document.createElement("div");
  dotsWrap.className = "deck-dots";
  dotsWrap.setAttribute("aria-hidden", "true");
  const dots = stops.map((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "deck-dot";
    dot.setAttribute("aria-label", `Go to section ${i + 1}`);
    dot.addEventListener("click", () => goTo(i));
    dotsWrap.appendChild(dot);
    return dot;
  });
  document.body.appendChild(dotsWrap);

  function updateChrome() {
    scrollTopBtn.classList.toggle("is-visible", current > 0);
    dots.forEach((d, i) => d.classList.toggle("is-active", i === current));
  }

  // --- Init ---
  // Sliding slides carry their content with them, so reveal them up-front
  // rather than on-activate (fading slides keep the reveal-on-activate look).
  stageSlides.forEach((slide, i) => {
    const g = enterOf(i);
    if (g === "horizontal" || g === "vertical") revealWithin(slide);
  });
  render();
  revealStop();
});
