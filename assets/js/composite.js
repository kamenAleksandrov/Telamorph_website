/* ==========================================================================
   Telamorph — Composite Development scrollytelling controller
   Pins one media panel and swaps the active stage image / tag / progress dot
   as each development step scrolls through the middle of the viewport.
   Pure progressive enhancement: without JS the page is a normal stacked read.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", initCompositeScrolly);

function initCompositeScrolly() {
  const scrolly = document.querySelector(".cd-scrolly");
  const steps = [...document.querySelectorAll(".cd-step")];
  if (!scrolly || steps.length === 0) return;

  const stageImages = document.querySelectorAll(".cd-stage-img");
  const progressDots = document.querySelectorAll(".cd-progress-dot");
  const stageTag = document.querySelector(".cd-stage-tag");

  // Mark JS-enhanced so the CSS dim/focus effect activates.
  scrolly.classList.add("is-enhanced");
  steps[0].classList.add("is-active");

  const setActiveStage = (stage, stepEl) => {
    steps.forEach((s) => s.classList.toggle("is-active", s === stepEl));

    stageImages.forEach((img) =>
      img.classList.toggle("is-active", img.dataset.stage === stage)
    );
    progressDots.forEach((dot) =>
      dot.classList.toggle("is-active", dot.dataset.stage === stage)
    );

    if (stageTag && stepEl.dataset.tag) {
      stageTag.textContent = stepEl.dataset.tag;
    }
  };

  if (!("IntersectionObserver" in window)) return;

  // A thin activation band across the vertical middle of the viewport: the
  // step crossing it is the one "in focus".
  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry) => setActiveStage(entry.target.dataset.stage, entry.target));
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
  );

  steps.forEach((step) => observer.observe(step));
}
