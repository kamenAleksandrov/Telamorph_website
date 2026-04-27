/* ==========================================================================
   Telamorph - Discover gallery loader
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initDiscoverGallery();
});

async function initDiscoverGallery() {
  const grid = document.getElementById("discover-gallery");
  if (!grid) return;

  const folder = normalizeFolder(grid.dataset.galleryFolder || "assets/images/gallery");
  const manifestUrl = grid.dataset.gallerySrc || "";

  try {
    const directoryImages = await loadGalleryDirectory(folder);
    const images = directoryImages.length ? directoryImages : await loadGalleryManifest(manifestUrl, folder);
    renderGallery(grid, images);
  } catch (err) {
    console.error("Gallery load failed:", err);
  }
}

async function loadGalleryManifest(manifestUrl, folder) {
  if (!manifestUrl) return [];

  const res = await fetch(manifestUrl, { cache: "no-cache" });
  if (!res.ok) return [];

  const data = await res.json();
  const entries = Array.isArray(data) ? data : data.images || data.files || data.gallery || [];
  return normalizeGalleryEntries(entries, folder);
}

async function loadGalleryDirectory(folder) {
  try {
    const res = await fetch(`${folder}/`, { cache: "no-cache" });
    if (!res.ok) return [];

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const folderUrl = new URL(`${folder}/`, window.location.href);
    const paths = [];

    doc.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!href || href === "../" || href.endsWith("/")) return;

      const url = new URL(href, folderUrl);
      if (!url.pathname.startsWith(folderUrl.pathname) || url.pathname === folderUrl.pathname) return;

      paths.push(`${url.pathname}${url.search}${url.hash}`);
    });

    return unique(paths);
  } catch {
    return [];
  }
}

function normalizeGalleryEntries(entries, folder) {
  const paths = entries
    .map((entry) => {
      if (typeof entry === "string") return entry;
      return entry?.src || entry?.path || entry?.file || entry?.name || "";
    })
    .filter(Boolean)
    .map((entry) => resolveGalleryPath(entry, folder));

  return unique(paths);
}

function resolveGalleryPath(entry, folder) {
  if (/^(https?:|data:|blob:)/i.test(entry)) return entry;
  if (entry.includes("/")) return entry;
  return `${folder}/${entry}`;
}

function renderGallery(grid, images) {
  if (!images.length) return;

  grid.innerHTML = images
    .map((src, index) => {
      const safeSrc = escapeAttribute(src);
      const alt = `Gallery image ${index + 1}`;

      return `
        <div class="col-6 col-md-4 col-lg-3 reveal">
          <a class="gallery-item" href="${safeSrc}" target="_blank" rel="noopener" aria-label="${alt}">
            <img src="${safeSrc}" alt="${alt}" loading="lazy" decoding="async">
          </a>
        </div>
      `;
    })
    .join("");

  window.initRevealOnScroll?.(grid);
}

function normalizeFolder(folder) {
  return folder.replace(/\/+$/, "");
}

function unique(items) {
  return [...new Set(items)];
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
