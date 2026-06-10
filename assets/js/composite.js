/* ==========================================================================
   Telamorph — Composite Development scrollytelling controller
   Desktop: one media panel pins beside the text and swaps the active stage
   image as each step crosses the middle of the viewport (CSS dims the rest).
   Mobile: the image becomes a band pinned to the top of the screen; it swaps
   per stage while each stage's text fades in and FULLY out before it slips
   behind the image. Progressive enhancement — without JS the page is a normal
   stacked read with one image per step.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", initCompositeScrolly);

function initCompositeScrolly() {
  const scrolly = document.querySelector(".cd-scrolly");
  const steps = [...document.querySelectorAll(".cd-step")];
  if (!scrolly || steps.length === 0) return;

  const stageImages = document.querySelectorAll(".cd-stage-img");
  const progressDots = document.querySelectorAll(".cd-progress-dot");
  const stageTag = document.querySelector(".cd-stage-tag");

  // Mark JS-enhanced so the CSS focus effect (desktop dim) activates.
  scrolly.classList.add("is-enhanced");
  steps[0].classList.add("is-active");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileMQ = window.matchMedia("(max-width: 991.98px)");

  const setActiveStage = (stage, stepEl) => {
    steps.forEach((s) => s.classList.toggle("is-active", s === stepEl));
    stageImages.forEach((img) =>
      img.classList.toggle("is-active", img.dataset.stage === stage)
    );
    progressDots.forEach((dot) =>
      dot.classList.toggle("is-active", dot.dataset.stage === stage)
    );
    if (stageTag && stepEl.dataset.tag) stageTag.textContent = stepEl.dataset.tag;
  };

  // ---- Active-stage observer (swaps the pinned image) -----------------------
  let observer = null;
  const buildObserver = () => {
    if (!("IntersectionObserver" in window)) return;
    if (observer) observer.disconnect();
    // Mobile: activate in the readable zone *below* the top image band.
    // Desktop: activate across the vertical middle (media sits beside the text).
    const rootMargin = mobileMQ.matches
      ? "-64% 0px -24% 0px"
      : "-45% 0px -45% 0px";
    observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry) =>
            setActiveStage(entry.target.dataset.stage, entry.target)
          );
      },
      { rootMargin, threshold: 0 }
    );
    steps.forEach((step) => observer.observe(step));
  };

  // ---- Mobile text fade -----------------------------------------------------
  // Opacity is driven by each step centre's position in the viewport: fully
  // gone at/above the image band (so nothing bleeds behind it), bright in the
  // readable zone below the band, fading back in from the bottom edge.
  const BAND = 0.44; // image band height as a fraction of the viewport
  const TOP_OUT = BAND + 0.01; // centre at/above here → opacity 0 (behind image)
  const TOP_FULL = BAND + 0.18; // fully visible from here down
  const BOT_FULL = 0.84; // …to here
  const BOT_OUT = 1.3; // fully faded once the centre passes the bottom edge — raise to start the next step's fade-in earlier (more overlap with the outgoing step)
  const smoothstep = (t) => t * t * (3 - 2 * t);

  let ticking = false;
  const paintFade = () => {
    ticking = false;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    steps.forEach((step) => {
      const rect = step.getBoundingClientRect();
      const ratio = (rect.top + rect.height / 2) / vh;
      let o;
      if (ratio <= TOP_OUT || ratio >= BOT_OUT) o = 0;
      else if (ratio < TOP_FULL) o = smoothstep((ratio - TOP_OUT) / (TOP_FULL - TOP_OUT));
      else if (ratio <= BOT_FULL) o = 1;
      else o = smoothstep((BOT_OUT - ratio) / (BOT_OUT - BOT_FULL));
      step.style.opacity = o.toFixed(3);
    });
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(paintFade);
  };

  let fadeOn = false;
  const enableFade = () => {
    if (fadeOn) return;
    fadeOn = true;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    paintFade();
  };
  const disableFade = () => {
    if (!fadeOn) return;
    fadeOn = false;
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    // Hand opacity back to the CSS (desktop dim / mobile fallback).
    steps.forEach((step) => step.style.removeProperty("opacity"));
  };

  // ---- Mode switching (re-evaluated when crossing the breakpoint) -----------
  const applyMode = () => {
    buildObserver();
    const bandMode = mobileMQ.matches && !reduceMotion && "IntersectionObserver" in window;
    scrolly.classList.toggle("cd-band", bandMode);
    if (bandMode) enableFade();
    else disableFade();
  };

  applyMode();
  if (mobileMQ.addEventListener) mobileMQ.addEventListener("change", applyMode);
  else if (mobileMQ.addListener) mobileMQ.addListener(applyMode); // older Safari
}
