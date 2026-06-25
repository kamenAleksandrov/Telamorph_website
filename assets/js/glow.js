/* Slides the ambient page glow (glow.css) from the previous page's position
   into this page's position when navigating between About / Contact / Become a
   Partner. Falls back to a static glow on direct visits or when the referrer
   isn't one of those pages.

   Loaded synchronously in <head> *after* glow.css, so it waits for that
   stylesheet and runs before first paint — the start position is seeded with
   no flash. */
(() => {
  const root = document.documentElement;
  const to = root.dataset.glow;
  if (!to) return;

  // Glow positions per page key — keep in sync with glow.css.
  const POS = {
    about: { ax: "28%", ay: "22%", bx: "78%", by: "82%" },
    contact: { ax: "50%", ay: "18%", bx: "50%", by: "84%" },
    partner: { ax: "74%", ay: "20%", bx: "24%", by: "82%" },
  };

  // Which glow page (if any) did we arrive from? Same-origin referrer only.
  const fromKey = (() => {
    try {
      const ref = new URL(document.referrer);
      if (ref.origin !== location.origin) return null;
      switch (ref.pathname.split("/").pop()) {
        case "about.html":
          return "about";
        case "contact.html":
          return "contact";
        case "resellers.html":
          return "partner";
      }
    } catch {
      /* empty or blocked referrer */
    }
    return null;
  })();

  const from = fromKey && fromKey !== to ? POS[fromKey] : null;
  if (!from) return; // direct visit → CSS renders straight at the target.

  // Seed the previous page's position with transitions off, before paint…
  root.style.transition = "none";
  root.style.setProperty("--glow-a-x", from.ax);
  root.style.setProperty("--glow-a-y", from.ay);
  root.style.setProperty("--glow-b-x", from.bx);
  root.style.setProperty("--glow-b-y", from.by);
  void root.offsetWidth; // flush the seeded values

  const clear = () => {
    root.style.transition = ""; // back to glow.css's transition
    root.style.removeProperty("--glow-a-x"); // back to glow.css's target
    root.style.removeProperty("--glow-a-y");
    root.style.removeProperty("--glow-b-x");
    root.style.removeProperty("--glow-b-y");
  };

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    clear(); // no motion: snap to target
    return;
  }

  // …then on the next frame hand control back to glow.css so it slides.
  requestAnimationFrame(() => requestAnimationFrame(clear));
})();
