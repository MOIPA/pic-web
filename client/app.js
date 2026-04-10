// ===== State =====
let images = [];
let currentLightboxIndex = -1;

// ===== DOM Elements =====
const $ = (sel) => document.querySelector(sel);
const gallery = $('#gallery');
const emptyState = $('#emptyState');
const imageCount = $('#imageCount');
const uploadOverlay = $('#uploadOverlay');
const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
const uploadProgress = $('#uploadProgress');
const progressFill = $('#progressFill');
const progressText = $('#progressText');
const dragOverlay = $('#dragOverlay');
const lightbox = $('#lightbox');
const lightboxImg = $('#lightboxImg');
const lightboxFilename = $('#lightboxFilename');
const lightboxDimensions = $('#lightboxDimensions');

// ===== API =====
const API_BASE = '';

async function fetchImages() {
  try {
    const res = await fetch(`${API_BASE}/api/images`);
    const data = await res.json();
    if (data.success) {
      images = data.images;
      render();
    }
  } catch (err) {
    showToast('Failed to load images');
    console.error(err);
  }
}

async function uploadFiles(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('photos', file);
  }

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
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error('Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.open('POST', `${API_BASE}/api/upload`);
      xhr.send(formData);
    });

    if (result.success) {
      images = [...result.images, ...images.filter(img =>
        !result.images.find(ni => ni.id === img.id)
      )];
      render();
      showToast(`${result.images.length} photo(s) uploaded!`);
      closeUploadModal();
    }
  } catch (err) {
    showToast('Upload failed');
    console.error(err);
  } finally {
    setTimeout(() => {
      uploadProgress.style.display = 'none';
      progressFill.style.width = '0%';
    }, 500);
  }
}

async function deleteImage(id) {
  try {
    const res = await fetch(`${API_BASE}/api/images/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      images = images.filter(img => img.id !== id);
      render();
      showToast('Photo deleted');
    }
  } catch (err) {
    showToast('Delete failed');
    console.error(err);
  }
}

// ===== Render =====
function render() {
  const hasImages = images.length > 0;
  emptyState.classList.toggle('hidden', hasImages);
  gallery.classList.toggle('hidden', !hasImages);
  imageCount.textContent = `${images.length} photo${images.length !== 1 ? 's' : ''}`;

  gallery.innerHTML = '';
  images.forEach((img, index) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.style.animationDelay = `${Math.min(index * 0.05, 0.5)}s`;

    // Set aspect ratio placeholder to prevent layout shift
    const ratio = (img.thumbHeight / img.thumbWidth) * 100;
    card.style.paddingBottom = ratio + '%';
    card.style.position = 'relative';

    card.innerHTML = `
      <img
        src="${img.thumbUrl}"
        alt="${img.originalName}"
        loading="lazy"
        style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;"
        onload="this.parentElement.style.background='transparent'"
      >
      <div class="card-overlay">
        <div class="card-actions">
          <button class="btn-delete" data-id="${img.id}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
        <div class="card-info">
          <div class="filename">${img.originalName}</div>
          <div class="dimensions">${img.width} x ${img.height}</div>
        </div>
      </div>
    `;

    // Click to open lightbox
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete')) return;
      openLightbox(index);
    });

    // Delete button
    const deleteBtn = card.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this photo?')) {
        deleteImage(img.id);
      }
    });

    gallery.appendChild(card);
  });
}

// ===== Upload Modal =====
function openUploadModal() {
  uploadOverlay.classList.add('active');
  uploadProgress.style.display = 'none';
}

function closeUploadModal() {
  uploadOverlay.classList.remove('active');
}

$('#uploadBtn').addEventListener('click', openUploadModal);
$('#emptyUploadBtn').addEventListener('click', openUploadModal);
$('#uploadClose').addEventListener('click', closeUploadModal);

uploadOverlay.addEventListener('click', (e) => {
  if (e.target === uploadOverlay) closeUploadModal();
});

// Dropzone click
dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    uploadFiles(fileInput.files);
    fileInput.value = '';
  }
});

// Dropzone drag events
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    uploadFiles(e.dataTransfer.files);
  }
});

// ===== Page-level Drag & Drop =====
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  if (dragCounter === 1) {
    dragOverlay.classList.add('active');
  }
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    dragOverlay.classList.remove('active');
  }
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dragOverlay.classList.remove('active');
  if (e.dataTransfer.files.length > 0) {
    uploadFiles(e.dataTransfer.files);
  }
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
  if (currentLightboxIndex < 0 || currentLightboxIndex >= images.length) return;
  const img = images[currentLightboxIndex];
  lightboxImg.src = img.url;
  lightboxFilename.textContent = img.originalName;
  lightboxDimensions.textContent = `${img.width} x ${img.height}`;
}

function lightboxPrev() {
  if (images.length === 0) return;
  currentLightboxIndex = (currentLightboxIndex - 1 + images.length) % images.length;
  updateLightbox();
}

function lightboxNext() {
  if (images.length === 0) return;
  currentLightboxIndex = (currentLightboxIndex + 1) % images.length;
  updateLightbox();
}

$('#lightboxClose').addEventListener('click', closeLightbox);
$('#lightboxPrev').addEventListener('click', lightboxPrev);
$('#lightboxNext').addEventListener('click', lightboxNext);

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
    closeLightbox();
  }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (lightbox.classList.contains('active')) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxPrev();
    if (e.key === 'ArrowRight') lightboxNext();
  }
  if (uploadOverlay.classList.contains('active')) {
    if (e.key === 'Escape') closeUploadModal();
  }
});

// ===== Toast =====
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== Init =====
fetchImages();
