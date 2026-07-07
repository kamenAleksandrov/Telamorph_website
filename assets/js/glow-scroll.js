/* Scroll-driven ambient glow for the Manufacturing page.

   Reuses the smooth page-nav slide from glow.css — the same 1.1s ease that
   moves the glow between About / Contact / Become a Partner — but triggers it
   on scroll: as each dark, glow-visible .svc-step band crosses the viewport
   centre, the two lobes glide to a fresh resting position. The opaque
   .svc-step--alt bands cover the glow, so we ignore them.

   Falls back to the static seeded position under reduced-motion. */
(() => {
  const root = document.documentElement;

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // The dark, transparent bands the glow shows through (steps 01, 03, 05).
  const sections = [
    ...document.querySelectorAll(".svc-step:not(.svc-step--alt)"),
  ];
  if (!sections.length) return;

  // Resting layouts cycled across the bands, one per section. Pushed further
  // toward the edges than the page-nav positions so the glow hugs the viewport
  // sides. Lobe A is {ax, ay}, lobe B is {bx, by} — percentages of the viewport.
  const RESTS = [
    { ax: 16, ay: 20, bx: 84, by: 82 }, // diagonal  ↖ ↘
    { ax: 84, ay: 20, bx: 16, by: 82 }, // diagonal  ↗ ↙
    { ax: 50, ay: 12, bx: 50, by: 88 }, // vertical column, top/bottom edges
  ];

  // Same slide as glow.css's page-nav transition. Set inline so it overrides
  // the page's first-paint `transition: none` seed. Interrupting a running
  // slide re-targets from the current interpolated value, so fast scrolling
  // stays smooth rather than snapping.
  root.style.transition =
    "--glow-a-x 1.1s ease, --glow-a-y 1.1s ease," +
    "--glow-b-x 1.1s ease, --glow-b-y 1.1s ease";

  const setPos = (p) => {
    root.style.setProperty("--glow-a-x", p.ax + "%");
    root.style.setProperty("--glow-a-y", p.ay + "%");
    root.style.setProperty("--glow-b-x", p.bx + "%");
    root.style.setProperty("--glow-b-y", p.by + "%");
  };

  // Fire when a band crosses the thin band at the viewport centre.
  let active = -1;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const idx = sections.indexOf(e.target);
        if (idx === active) continue;
        active = idx;
        setPos(RESTS[idx % RESTS.length]);
      }
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
  );
  sections.forEach((s) => io.observe(s));
})();
