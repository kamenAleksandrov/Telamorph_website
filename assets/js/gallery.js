/* ==========================================================================
   Telamorph - Discover gallery loader
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initDiscoverGallery();
});

const galleryPreview = {
  images: [],
  index: 0,
  modal: null,
  modalEl: null,
  imageEl: null,
  countEl: null,
  prevBtn: null,
  nextBtn: null
};

async function initDiscoverGallery() {
  const grid = document.getElementById("discover-gallery");
  if (!grid) return;

  const folder = normalizeFolder(grid.dataset.galleryFolder || "assets/images/gallery");
  const manifestUrl = grid.dataset.gallerySrc || "";

  try {
    const manifestImages = await loadGalleryManifest(manifestUrl, folder);
    const images = manifestImages.length ? manifestImages : await loadGalleryDirectory(folder);
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

  galleryPreview.images = images;

  grid.innerHTML = images
    .map((src, index) => {
      const safeSrc = escapeAttribute(src);
      const alt = `Gallery image ${index + 1}`;

      return `
        <div class="col-6 col-md-4 col-lg-3 reveal">
          <a class="gallery-item" href="${safeSrc}" target="_blank" rel="noopener" data-gallery-index="${index}" aria-label="Open ${alt}">
            <img src="${safeSrc}" alt="${alt}" loading="lazy" decoding="async">
          </a>
        </div>
      `;
    })
    .join("");

  initGalleryPreview(grid);
  window.initRevealOnScroll?.(grid);
}

function initGalleryPreview(grid) {
  const modalEl = ensureGalleryPreviewModal();
  if (!modalEl || !window.bootstrap?.Modal) return;

  galleryPreview.modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);

  if (!grid.dataset.galleryPreviewReady) {
    grid.dataset.galleryPreviewReady = "true";
    grid.addEventListener("click", handleGalleryClick);
  }
}

function ensureGalleryPreviewModal() {
  let modalEl = document.getElementById("gallery-preview-modal");

  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.className = "modal fade gallery-modal";
    modalEl.id = "gallery-preview-modal";
    modalEl.tabIndex = -1;
    modalEl.setAttribute("aria-labelledby", "gallery-preview-title");
    modalEl.setAttribute("aria-hidden", "true");
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content gallery-modal-content">
          <div class="modal-header gallery-modal-header">
            <div>
              <h2 class="modal-title" id="gallery-preview-title">Gallery preview</h2>
              <p class="gallery-modal-count" id="gallery-preview-count"></p>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body gallery-modal-body">
            <button type="button" class="gallery-modal-nav gallery-modal-prev" data-gallery-action="prev" aria-label="Previous image"><span aria-hidden="true">&lsaquo;</span></button>
            <img class="gallery-modal-image" id="gallery-preview-image" src="" alt="">
            <button type="button" class="gallery-modal-nav gallery-modal-next" data-gallery-action="next" aria-label="Next image"><span aria-hidden="true">&rsaquo;</span></button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  galleryPreview.modalEl = modalEl;
  galleryPreview.imageEl = modalEl.querySelector("#gallery-preview-image");
  galleryPreview.countEl = modalEl.querySelector("#gallery-preview-count");
  galleryPreview.prevBtn = modalEl.querySelector('[data-gallery-action="prev"]');
  galleryPreview.nextBtn = modalEl.querySelector('[data-gallery-action="next"]');

  if (!modalEl.dataset.galleryPreviewReady) {
    modalEl.dataset.galleryPreviewReady = "true";
    modalEl.addEventListener("click", handleGalleryPreviewClick);
    modalEl.addEventListener("keydown", handleGalleryPreviewKeydown);
    modalEl.addEventListener("hidden.bs.modal", () => {
      if (galleryPreview.imageEl) galleryPreview.imageEl.src = "";
    });
  }

  return modalEl;
}

function handleGalleryClick(event) {
  const item = event.target.closest(".gallery-item");
  if (!item || !galleryPreview.modal) return;

  const index = Number.parseInt(item.dataset.galleryIndex, 10);
  if (Number.isNaN(index)) return;

  event.preventDefault();
  openGalleryPreview(index);
}

function handleGalleryPreviewClick(event) {
  const action = event.target.closest("[data-gallery-action]")?.dataset.galleryAction;
  if (action === "prev") showGalleryPreviewImage(galleryPreview.index - 1);
  if (action === "next") showGalleryPreviewImage(galleryPreview.index + 1);
}

function handleGalleryPreviewKeydown(event) {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    showGalleryPreviewImage(galleryPreview.index - 1);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    showGalleryPreviewImage(galleryPreview.index + 1);
  }
}

function openGalleryPreview(index) {
  showGalleryPreviewImage(index);
  galleryPreview.modal.show();
}

function showGalleryPreviewImage(index) {
  const total = galleryPreview.images.length;
  if (!total || !galleryPreview.imageEl) return;

  galleryPreview.index = (index + total) % total;
  const src = galleryPreview.images[galleryPreview.index];
  const alt = `Gallery image ${galleryPreview.index + 1}`;

  galleryPreview.imageEl.src = src;
  galleryPreview.imageEl.alt = alt;

  if (galleryPreview.countEl) {
    galleryPreview.countEl.textContent = `${galleryPreview.index + 1} / ${total}`;
  }

  const hasMultipleImages = total > 1;
  if (galleryPreview.prevBtn) galleryPreview.prevBtn.disabled = !hasMultipleImages;
  if (galleryPreview.nextBtn) galleryPreview.nextBtn.disabled = !hasMultipleImages;
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
