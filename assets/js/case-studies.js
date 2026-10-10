/* Case Studies browser (case-studies.html).

   Overview: the case cards as rows. Opening a case collapses the rows into a
   tab strip, highlights the chosen one and shows only that case below;
   Previous / Next links under it step through the rest. The open case lives
   in the URL hash (#<slug>), so a link to one case can be shared and
   Back/Forward step between cases.

   The row → tab change morphs with the View Transitions API where supported;
   elsewhere (and under reduced motion) it simply switches. Without JS every
   case renders in full and the cards are plain in-page anchors. */
(() => {
  const browser = document.querySelector("[data-cs-browser]");
  if (!browser) return;

  const root = document.documentElement;
  const cards = [...browser.querySelectorAll(".cs-card[data-case-link]")];
  const cases = new Map(
    cards.map((card) => [
      card.dataset.caseLink,
      document.getElementById(card.dataset.caseLink),
    ]),
  );
  const slugs = [...cases.keys()];
  const pager = browser.querySelector("[data-cs-pager]");
  const baseTitle = document.title;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let current = null;
  let activeTransition = null;

  root.classList.add("cs-js");
  cards.forEach((card, i) => {
    card.style.viewTransitionName = `cs-card-${i}`;
  });

  // Show every case row straight away rather than on scroll: the lower rows
  // sit below the fold, and a visitor skimming the list could miss them.
  const list = browser.querySelector(".cs-cards");
  if (list && typeof window.initRevealOnScroll === "function") {
    window.initRevealOnScroll(list, { immediate: true });
  }

  const slugFromHash = () => {
    let slug = location.hash.slice(1);
    try {
      slug = decodeURIComponent(slug);
    } catch {
      return null;
    }
    return cases.has(slug) ? slug : null;
  };

  const caseTitle = (slug) =>
    cases.get(slug)?.querySelector(".cs-case-title")?.textContent.trim() || "";

  // An open case compacts the hero (see .cs-open in the CSS), so the top of
  // the page shows the title, the tab strip and the case together. Anything
  // scrolled lower would slide under the fixed logo in the top-left.
  function scrollToTop(behavior) {
    window.scrollTo({ top: 0, behavior });
  }

  function renderPager(slug) {
    if (!pager) return;
    const index = slugs.indexOf(slug);
    if (index < 0) {
      pager.hidden = true;
      pager.replaceChildren();
      return;
    }

    const link = (target, label, className) => {
      const a = document.createElement("a");
      a.className = `cs-pager-link ${className}`;
      a.href = `#${target}`;
      a.dataset.caseLink = target;
      const small = document.createElement("span");
      small.className = "cs-pager-label";
      small.textContent = label;
      const title = document.createElement("span");
      title.className = "cs-pager-title";
      title.textContent = caseTitle(target);
      a.append(small, title);
      return a;
    };

    const items = [];
    if (index > 0) items.push(link(slugs[index - 1], "Previous", "is-prev"));
    const all = document.createElement("a");
    all.className = "cs-pager-all";
    all.href = "#";
    all.dataset.csAll = "";
    all.textContent = "All case studies";
    items.push(all);
    if (index < slugs.length - 1) {
      items.push(link(slugs[index + 1], "Next", "is-next"));
    }
    pager.replaceChildren(...items);
    pager.hidden = false;
  }

  // Put the DOM into the state for `slug` (null = overview).
  function apply(slug) {
    current = slug;
    root.classList.toggle("cs-open", Boolean(slug));
    browser.classList.toggle("is-open", Boolean(slug));
    cards.forEach((card) => {
      const active = card.dataset.caseLink === slug;
      card.classList.toggle("is-active", active);
      if (active) card.setAttribute("aria-current", "true");
      else card.removeAttribute("aria-current");
    });
    cases.forEach((article, key) => {
      if (article) article.hidden = key !== slug;
    });
    renderPager(slug);
    document.title = slug
      ? `${caseTitle(slug)} | Case Studies | Telamorph`
      : baseTitle;
  }

  function keepActiveTabInView(behavior = "smooth") {
    const active = browser.querySelector(".cs-card.is-active");
    const strip = active?.closest(".cs-cards");
    if (!active || !strip || strip.scrollWidth <= strip.clientWidth) return;
    const tab = active.getBoundingClientRect();
    const box = strip.getBoundingClientRect();
    strip.scrollTo({
      left:
        strip.scrollLeft +
        (tab.left - box.left) -
        (box.width - tab.width) / 2,
      behavior,
    });
  }

  function show(slug, { push = true } = {}) {
    if (slug === current) {
      scrollToTop("smooth");
      return;
    }
    // Claim the new state now: the transition runs `update` asynchronously,
    // and Back fires both popstate and hashchange.
    const previous = current;
    current = slug;
    if (push) {
      const url = slug
        ? `#${encodeURIComponent(slug)}`
        : location.pathname + location.search;
      history.pushState(null, "", url);
    }

    // Morph only when the rows collapse into tabs or expand back. Switching
    // tab to tab moves nothing, and skipping the transition there keeps the
    // tabs clickable at once (Chrome routes clicks made during a transition
    // to <html>, not to what is under the pointer).
    const animate =
      typeof document.startViewTransition === "function" &&
      !reducedMotion.matches &&
      Boolean(slug) !== Boolean(previous);

    const update = () => {
      apply(slug);
      // Scroll inside the update so the transition's "after" snapshot is
      // already at the new position (scrolling mid-transition would jump).
      scrollToTop(animate ? "instant" : "smooth");
    };

    const done = () => {
      keepActiveTabInView();
      if (slug) {
        cases
          .get(slug)
          ?.querySelector(".cs-case-title")
          ?.focus({ preventScroll: true });
      }
    };

    if (animate) {
      const transition = document.startViewTransition(update);
      activeTransition = transition;
      // A click during the morph skips it (see below); that's expected, so
      // don't let the rejected `ready` promise surface as an error.
      transition.ready.catch(() => {});
      transition.finished.then(done, done).finally(() => {
        if (activeTransition === transition) activeTransition = null;
      });
    } else {
      update();
      done();
    }
  }

  // A click during the row ↔ tab morph lands on <html> (see `animate` above):
  // finish the morph now, then act on whatever sits under the pointer, so a
  // visitor never has to wait for the animation.
  document.addEventListener(
    "click",
    (event) => {
      if (!activeTransition || event.target !== root) return;
      const { clientX: x, clientY: y } = event;
      const transition = activeTransition;
      transition.skipTransition();
      transition.finished.finally(() => {
        document
          .elementFromPoint(x, y)
          ?.closest("[data-case-link], [data-cs-all]")
          ?.click();
      });
    },
    true,
  );

  // Cards, pager links and "All case studies" are real anchors: let modified
  // clicks (new tab, copy link) through, handle plain ones in-page.
  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const caseLink = event.target.closest("[data-case-link]");
    if (caseLink && cases.has(caseLink.dataset.caseLink)) {
      event.preventDefault();
      show(caseLink.dataset.caseLink);
      return;
    }
    if (event.target.closest("[data-cs-all]")) {
      event.preventDefault();
      show(null);
    }
  });

  // Back / Forward, or a hash typed into the address bar.
  const sync = () => {
    const slug = slugFromHash();
    if (slug !== current) show(slug, { push: false });
  };
  window.addEventListener("popstate", sync);
  window.addEventListener("hashchange", sync);

  // Soft light that follows the pointer across a card, plus the bright point
  // of the top-edge streak on cards and result panels (same --streak-x
  // convention as streak.css).
  const streakTargets = [
    ...cards,
    ...browser.querySelectorAll(".cs-result"),
  ];
  streakTargets.forEach((el) => {
    el.addEventListener("pointermove", (event) => {
      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${event.clientY - rect.top}px`);
      el.style.setProperty("--streak-x", `${(x / rect.width) * 100}%`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.removeProperty("--streak-x");
    });
  });

  // Initial state. A deep link opens its case straight away, no animation.
  const initial = slugFromHash();
  apply(initial);
  if (initial) {
    keepActiveTabInView("instant");
    // The browser's own fragment scroll (to the article) may run after this;
    // settle again on load so the page opens at the top.
    const settle = () => scrollToTop("instant");
    settle();
    if (document.readyState !== "complete") {
      window.addEventListener("load", settle, { once: true });
    }
  }
})();
