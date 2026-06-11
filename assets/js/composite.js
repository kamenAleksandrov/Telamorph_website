/* ==========================================================================
   Telamorph — Composite Development scrollytelling controller
   Desktop: one media panel pins beside the text and swaps the active stage
   image as each step crosses the middle of the viewport (CSS dims the rest).
   Mobile: NO pinning — a plain stacked read with one inline image per step.
   The per-step text fade-in (both viewports) is handled site-wide by the
   `.reveal` system in main.js; this controller only drives the desktop panel.
   Active-stage detection is one discrete, monotonic test ("which step's top
   has passed the viewport middle?"), so it can't break on resizing chrome.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", initCompositeScrolly);

function initCompositeScrolly() {
  const scrolly = document.querySelector(".cd-scrolly");
  const steps = [...document.querySelectorAll(".cd-step")];
  if (!scrolly || steps.length === 0) return;

  const stageImages = document.querySelectorAll(".cd-stage-img");
  const progressDots = document.querySelectorAll(".cd-progress-dot");
  const stageTag = document.querySelector(".cd-stage-tag");
  const desktopMQ = window.matchMedia("(min-width: 992px)");

  let activeStep = null;
  const setActiveStep = (stepEl) => {
    if (stepEl === activeStep) return;
    activeStep = stepEl;
    const stage = stepEl.dataset.stage;
    steps.forEach((s) => s.classList.toggle("is-active", s === stepEl));
    stageImages.forEach((img) =>
      img.classList.toggle("is-active", img.dataset.stage === stage)
    );
    progressDots.forEach((dot) =>
      dot.classList.toggle("is-active", dot.dataset.stage === stage)
    );
    if (stageTag && stepEl.dataset.tag) stageTag.textContent = stepEl.dataset.tag;
  };

  let ticking = false;
  const updateActive = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const lineY = vh * 0.5;
    let current = steps[0];
    for (const step of steps) {
      if (step.getBoundingClientRect().top <= lineY) current = step;
      else break;
    }
    setActiveStep(current);
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      updateActive();
    });
  };

  // The pinned panel only exists on desktop; toggle the focus logic when
  // crossing the breakpoint so mobile is left as a plain stacked read.
  let desktopOn = false;
  const enableDesktop = () => {
    if (desktopOn) return;
    desktopOn = true;
    scrolly.classList.add("is-enhanced");
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    updateActive();
  };
  const disableDesktop = () => {
    if (!desktopOn) return;
    desktopOn = false;
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    scrolly.classList.remove("is-enhanced");
    steps.forEach((s) => s.classList.remove("is-active"));
    activeStep = null;
  };

  const applyMode = () => (desktopMQ.matches ? enableDesktop() : disableDesktop());
  applyMode();
  if (desktopMQ.addEventListener) desktopMQ.addEventListener("change", applyMode);
  else if (desktopMQ.addListener) desktopMQ.addListener(applyMode); // older Safari
}
