// ===== State =====
let images = [];
let filteredImages = [];
let currentLightboxIndex = -1;
let currentPage = 'home';
let currentCategory = 'all';
let searchQuery = '';
let sortMode = 'newest';
let columnCount = 3;

// ===== DOM =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const gallery = $('#gallery');
const emptyState = $('#emptyState');
const hero = $('#hero');
const heroBg = $('#heroBg');
const heroStats = $('#heroStats');
const statsText = $('#statsText');
const favCount = $('#favCount');
const uploadOverlay = $('#uploadOverlay');
const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
const uploadCategory = $('#uploadCategory');
const uploadProgress = $('#uploadProgress');
const progressFill = $('#progressFill');
const progressText = $('#progressText');
const dragOverlay = $('#dragOverlay');
const lightbox = $('#lightbox');
const lightboxImg = $('#lightboxImg');
const lightboxFilename = $('#lightboxFilename');
const lightboxDimensions = $('#lightboxDimensions');
const lightboxCategory = $('#lightboxCategory');
const lightboxCatSep = $('#lightboxCatSep');
const lightboxLocSep = $('#lightboxLocSep');
const lightboxLocation = $('#lightboxLocation');
const lightboxLocationText = $('#lightboxLocationText');
const lightboxFavBtn = $('#lightboxFavBtn');
const lightboxDeleteBtn = $('#lightboxDeleteBtn');
const searchInput = $('#searchInput');
const sortSelect = $('#sortSelect');
const sidebar = $('#sidebar');

// ===== API =====
const API = '';

async function fetchImages() {
  try {
    const res = await fetch(`${API}/api/images`);
    const data = await res.json();
    if (data.success) {
      images = data.images;
      applyFilters();
    }
  } catch (err) {
    showToast('Failed to load images');
  }
}

async function uploadFiles(files) {
  const formData = new FormData();
  for (const file of files) formData.append('photos', file);
  const cat = uploadCategory.value;
  if (cat) formData.append('category', cat);
  const loc = $('#uploadLocation').value.trim();
  if (loc) formData.append('location', loc);

  uploadProgress.style.display = 'block';
  progressFill.style.width = '0%';
  progressText.textContent = `Uploading ${files.length} file(s)...`;

  try {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `Uploading... ${pct}%`;
      }
    });

    const result = await new Promise((resolve, reject) => {
      xhr.onload = () => xhr.status === 200 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error('Upload failed'));
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.open('POST', `${API}/api/upload`);
      xhr.send(formData);
    });

    if (result.success) {
      images = [...result.images, ...images.filter(img => !result.images.find(ni => ni.id === img.id))];
      applyFilters();
      showToast(`${result.images.length} photo(s) uploaded!`);
      closeUploadModal();
    }
  } catch (err) {
    showToast('Upload failed');
  } finally {
    setTimeout(() => { uploadProgress.style.display = 'none'; progressFill.style.width = '0%'; }, 500);
  }
}

async function deleteImage(id) {
  try {
    const res = await fetch(`${API}/api/images/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      images = images.filter(img => img.id !== id);
      applyFilters();
      showToast('Photo deleted');
    }
  } catch (err) {
    showToast('Delete failed');
  }
}

async function toggleFavorite(id) {
  const img = images.find(i => i.id === id);
  if (!img) return;
  try {
    const res = await fetch(`${API}/api/images/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite: !img.favorite })
    });
    const data = await res.json();
    if (data.success) {
      img.favorite = !img.favorite;
      applyFilters();
    }
  } catch (err) {
    showToast('Action failed');
  }
}

// ===== Filter & Sort =====
function applyFilters() {
  let list = [...images];

  // Page filter
  if (currentPage === 'favorites') {
    list = list.filter(img => img.favorite);
  }

  // Category filter
  if (currentCategory !== 'all') {
    list = list.filter(img => img.category === currentCategory);
  }

  // Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(img =>
      img.originalName.toLowerCase().includes(q) ||
      (img.category && img.category.toLowerCase().includes(q)) ||
      (img.location && img.location.toLowerCase().includes(q))
    );
  }

  // Sort
  switch (sortMode) {
    case 'oldest': list.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt)); break;
    case 'name': list.sort((a, b) => a.originalName.localeCompare(b.originalName)); break;
    case 'size': list.sort((a, b) => b.size - a.size); break;
    default: list.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  filteredImages = list;
  render();
}

// ===== Render =====
function render() {
  const hasImages = filteredImages.length > 0;
  const totalImages = images.length;
  emptyState.classList.toggle('hidden', hasImages);
  gallery.classList.toggle('hidden', !hasImages);

  // Stats
  const totalSize = images.reduce((s, i) => s + (i.size || 0), 0);
  const sizeStr = totalSize > 1048576 ? (totalSize / 1048576).toFixed(1) + ' MB' : (totalSize / 1024).toFixed(0) + ' KB';
  statsText.textContent = `${totalImages} photos \u00B7 ${sizeStr}`;
  heroStats.textContent = `${totalImages} photos in your collection`;

  // Fav count
  const favTotal = images.filter(i => i.favorite).length;
  favCount.style.display = favTotal > 0 ? '' : 'none';
  favCount.textContent = favTotal;

  // Hero
  if (totalImages > 0) {
    hero.style.display = '';
    const heroImg = images[0];
    heroBg.style.backgroundImage = `url(${heroImg.thumbUrl})`;
  } else {
    hero.style.display = 'none';
  }

  // Column count
  gallery.classList.toggle('cols-4', columnCount === 4);

  // Cards
  gallery.innerHTML = '';
  filteredImages.forEach((img, index) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.style.animationDelay = `${Math.min(index * 0.04, 0.4)}s`;

    const ratio = (img.thumbHeight / img.thumbWidth) * 100;
    card.style.paddingBottom = ratio + '%';
    card.style.position = 'relative';

    const dateStr = new Date(img.uploadedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

    card.innerHTML = `
      <img src="${img.thumbUrl}" alt="${img.originalName}" loading="lazy"
        style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;"
        onload="this.parentElement.style.background='transparent'">
      <div class="card-overlay">
        <div class="card-actions-top">
          <button class="card-btn btn-fav${img.favorite ? ' active' : ''}" data-id="${img.id}" title="Favorite">
            <svg viewBox="0 0 24 24" fill="${img.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="15" height="15">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </button>
          <button class="card-btn btn-card-delete" data-id="${img.id}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
        <div class="card-info-bottom">
          <div class="card-filename">${img.originalName}</div>
          <div class="card-meta">
            <span>${img.width}\u00D7${img.height}</span>
            <span>${dateStr}</span>
            ${img.category ? `<span class="card-category-badge">${img.category}</span>` : ''}
            ${img.location ? `<span class="card-location-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${img.location}</span>` : ''}
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-btn')) return;
      const idx = filteredImages.findIndex(i => i.id === img.id);
      openLightbox(idx);
    });

    card.querySelector('.btn-fav').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(img.id);
    });

    card.querySelector('.btn-card-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this photo?')) deleteImage(img.id);
    });

    gallery.appendChild(card);
  });
}

// ===== Sidebar Nav =====
$$('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    currentPage = item.dataset.page;
    if (currentPage !== 'favorites') currentCategory = 'all';
    syncCategoryUI();
    applyFilters();
    closeSidebarMobile();
  });
});

// ===== Category Filter =====
function syncCategoryUI() {
  $$('.category-item').forEach(c => c.classList.toggle('active', c.dataset.category === currentCategory));
  $$('.tag-pill').forEach(t => t.classList.toggle('active', t.dataset.category === currentCategory));
}

$$('.category-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    currentCategory = item.dataset.category;
    syncCategoryUI();
    applyFilters();
  });
});

$$('.tag-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    currentCategory = pill.dataset.category;
    syncCategoryUI();
    applyFilters();
  });
});

// ===== Search =====
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    applyFilters();
  }, 250);
});

// ===== Sort =====
sortSelect.addEventListener('change', () => {
  sortMode = sortSelect.value;
  applyFilters();
});

// ===== View Toggle =====
$$('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    columnCount = parseInt(btn.dataset.cols);
    render();
  });
});

// ===== Mobile Sidebar =====
$('#hamburgerBtn').addEventListener('click', () => {
  sidebar.classList.add('open');
  $('#sidebarBackdrop').classList.add('open');
});

function closeSidebarMobile() {
  sidebar.classList.remove('open');
  $('#sidebarBackdrop').classList.remove('open');
}

$('#sidebarBackdrop').addEventListener('click', closeSidebarMobile);

// ===== Theme Switcher =====
function applyTheme(theme) {
  if (theme && theme !== 'indigo') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  $$('.theme-dot').forEach(d => d.classList.toggle('active', d.dataset.theme === (theme || 'indigo')));
  localStorage.setItem('theme', theme || 'indigo');
}

// Init theme from localStorage
applyTheme(localStorage.getItem('theme') || 'indigo');

$$('.theme-dot').forEach(dot => {
  dot.addEventListener('click', () => applyTheme(dot.dataset.theme));
});

// ===== Upload Modal =====
function openUploadModal() {
  uploadOverlay.classList.add('active');
  uploadProgress.style.display = 'none';
  uploadCategory.value = currentCategory !== 'all' ? currentCategory : '';
  $('#uploadLocation').value = '';
}

function closeUploadModal() {
  uploadOverlay.classList.remove('active');
}

$('#sidebarUploadBtn').addEventListener('click', openUploadModal);
$('#mobileUploadBtn').addEventListener('click', openUploadModal);
$('#emptyUploadBtn').addEventListener('click', openUploadModal);
$('#uploadClose').addEventListener('click', closeUploadModal);
uploadOverlay.addEventListener('click', (e) => { if (e.target === uploadOverlay) closeUploadModal(); });

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) { uploadFiles(fileInput.files); fileInput.value = ''; }
});

dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault(); dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
});

// ===== Page Drag & Drop =====
let dragCounter = 0;
document.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; if (dragCounter === 1) dragOverlay.classList.add('active'); });
document.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter === 0) dragOverlay.classList.remove('active'); });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault(); dragCounter = 0; dragOverlay.classList.remove('active');
  if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
});

// ===== Lightbox =====
function openLightbox(index) {
  currentLightboxIndex = index;
  updateLightbox();
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
  currentLightboxIndex = -1;
}

function updateLightbox() {
  if (currentLightboxIndex < 0 || currentLightboxIndex >= filteredImages.length) return;
  const img = filteredImages[currentLightboxIndex];
  lightboxImg.src = img.url;
  lightboxFilename.textContent = img.originalName;
  lightboxDimensions.textContent = `${img.width} \u00D7 ${img.height}`;

  if (img.category) {
    lightboxCategory.textContent = img.category;
    lightboxCatSep.style.display = '';
  } else {
    lightboxCategory.textContent = '';
    lightboxCatSep.style.display = 'none';
  }

  if (img.location) {
    lightboxLocationText.textContent = img.location;
    lightboxLocSep.style.display = '';
    lightboxLocation.style.display = '';
  } else {
    lightboxLocationText.textContent = '';
    lightboxLocSep.style.display = 'none';
    lightboxLocation.style.display = 'none';
  }

  lightboxFavBtn.classList.toggle('active', !!img.favorite);
}

function lightboxPrev() {
  if (filteredImages.length === 0) return;
  currentLightboxIndex = (currentLightboxIndex - 1 + filteredImages.length) % filteredImages.length;
  updateLightbox();
}

function lightboxNext() {
  if (filteredImages.length === 0) return;
  currentLightboxIndex = (currentLightboxIndex + 1) % filteredImages.length;
  updateLightbox();
}

$('#lightboxClose').addEventListener('click', closeLightbox);
$('#lightboxPrev').addEventListener('click', lightboxPrev);
$('#lightboxNext').addEventListener('click', lightboxNext);

lightboxFavBtn.addEventListener('click', () => {
  if (currentLightboxIndex >= 0) {
    const img = filteredImages[currentLightboxIndex];
    toggleFavorite(img.id);
  }
});

lightboxDeleteBtn.addEventListener('click', () => {
  if (currentLightboxIndex >= 0) {
    const img = filteredImages[currentLightboxIndex];
    if (confirm('Delete this photo?')) {
      deleteImage(img.id);
      closeLightbox();
    }
  }
});

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target.classList.contains('lightbox-content')) closeLightbox();
});

document.addEventListener('keydown', (e) => {
  if (lightbox.classList.contains('active')) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxPrev();
    if (e.key === 'ArrowRight') lightboxNext();
  }
  if (uploadOverlay.classList.contains('active') && e.key === 'Escape') closeUploadModal();
});

// ===== Toast =====
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ===== Auth =====
async function checkAuth() {
  try {
    const res = await fetch(`${API}/api/auth/check`);
    if (res.status === 401) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  } catch {
    return true; // if endpoint doesn't exist, allow
  }
}

async function logout() {
  try {
    await fetch(`${API}/api/logout`, { method: 'POST' });
  } catch {}
  window.location.href = '/login.html';
}

// Wrap fetch to handle 401 globally
const _origFetch = window.fetch;
window.fetch = async (...args) => {
  const res = await _origFetch(...args);
  if (res.status === 401 && !args[0]?.toString().includes('/api/auth/check')) {
    window.location.href = '/login.html';
  }
  return res;
};

// ===== Init =====
(async () => {
  const authed = await checkAuth();
  if (authed) fetchImages();
})();

// Logout button
$('#logoutBtn')?.addEventListener('click', logout);
