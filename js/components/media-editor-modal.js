// Component: Fullscreen WhatsApp Multi-Photo/Video Editor & Caption Modal
import { Icons } from '../icons.js';

export class MediaEditorModal {
  constructor(options = {}) {
    this.recipientName = options.recipientName || 'Contact';
    this.onSend = options.onSend || (() => {});
    this.onAddMore = options.onAddMore || (() => {});
    this.container = null;
    this.items = []; // Array of { file, blob, url, type, isVideo }
    this.activeIndex = 0;
    this.isHd = false;
  }

  show(initialFiles = []) {
    this.items = initialFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      isVideo: file.type.startsWith('video/')
    }));

    if (this.items.length === 0) return;
    this.activeIndex = 0;
    this.isHd = false;

    if (window.router) {
      window.router.pushOverlay('media-editor-modal', () => this.close(false));
    }

    this.render();
  }

  addFiles(newFiles = []) {
    const newItems = newFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      isVideo: file.type.startsWith('video/')
    }));

    this.items.push(...newItems);
    this.updateThumbnails();
  }

  render() {
    // Remove existing if any
    const existing = document.querySelector('.media-editor-modal');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.className = 'media-editor-modal';

    const currentItem = this.items[this.activeIndex];

    this.container.innerHTML = `
      <!-- Top Functional Bar -->
      <header class="media-editor-header">
        <button type="button" class="editor-icon-btn" id="btn-editor-close" aria-label="Close">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
        <div class="editor-header-actions">
          <button type="button" class="editor-hd-btn ${this.isHd ? 'active' : ''}" id="btn-editor-hd" aria-label="HD quality">
            <span class="hd-box">HD</span>
          </button>
        </div>
      </header>

      <!-- Center Main Preview -->
      <div class="media-editor-preview-stage" id="editor-preview-stage">
        ${this.renderActivePreview(currentItem)}
      </div>

      <!-- Bottom Panel: Thumbnails, Caption & Send -->
      <footer class="media-editor-footer">
        <!-- Thumbnail Strip Carousel -->
        <div class="editor-thumbnails-carousel" id="editor-thumbnails-carousel">
          ${this.renderThumbnailsHtml()}
        </div>

        <!-- Caption Bar -->
        <div class="editor-caption-wrap">
          <div class="editor-caption-pill">
            <div class="editor-caption-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
            </div>
            <input type="text" class="editor-caption-input" id="editor-caption-input" placeholder="Add a caption..." autocomplete="off" />
          </div>
        </div>

        <!-- Recipient & Send Row -->
        <div class="editor-bottom-action-row">
          <div class="editor-recipient-pill">
            <span class="editor-recipient-name">${this.recipientName}</span>
          </div>

          <button type="button" class="editor-send-btn" id="btn-editor-send" aria-label="Send">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </footer>

      <!-- Hidden file input for Add More -->
      <input type="file" id="editor-add-more-input" accept="image/*,video/*" multiple style="display:none;" />
    `;

    document.body.appendChild(this.container);
    this.bindEvents();
  }

  renderActivePreview(item) {
    if (!item) return '';
    if (item.isVideo) {
      return `<video src="${item.url}" class="editor-main-media" controls autoplay playsinline></video>`;
    }
    return `<img src="${item.url}" class="editor-main-media" alt="Preview" />`;
  }

  renderThumbnailsHtml() {
    const thumbs = this.items.map((item, idx) => {
      const isActive = idx === this.activeIndex;
      return `
        <div class="editor-thumb-box ${isActive ? 'active' : ''}" data-index="${idx}">
          <img src="${item.url}" class="editor-thumb-img" alt="thumb" />
          ${isActive && this.items.length > 1 ? `
            <button type="button" class="editor-thumb-delete" data-delete-index="${idx}" title="Delete photo">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    // Add More button
    const addMoreBtn = `
      <button type="button" class="editor-thumb-add-btn" id="btn-editor-add-more" title="Add more photos">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>
    `;

    return thumbs + addMoreBtn;
  }

  updateThumbnails() {
    const carousel = this.container.querySelector('#editor-thumbnails-carousel');
    if (carousel) {
      carousel.innerHTML = this.renderThumbnailsHtml();
      this.bindThumbnailEvents();
    }
    const stage = this.container.querySelector('#editor-preview-stage');
    if (stage) {
      stage.innerHTML = this.renderActivePreview(this.items[this.activeIndex]);
    }
  }

  bindEvents() {
    // Close
    this.container.querySelector('#btn-editor-close').addEventListener('click', () => {
      this.close();
    });

    // HD Quality Toggle
    const hdBtn = this.container.querySelector('#btn-editor-hd');
    if (hdBtn) {
      hdBtn.addEventListener('click', () => {
        this.isHd = !this.isHd;
        hdBtn.classList.toggle('active', this.isHd);
      });
    }

    // Send Button
    this.container.querySelector('#btn-editor-send').addEventListener('click', () => {
      const caption = this.container.querySelector('#editor-caption-input').value.trim();
      const files = this.items.map((i) => i.file);
      this.close();
      this.onSend({ files, caption, isHd: this.isHd });
    });

    this.bindThumbnailEvents();
  }

  bindThumbnailEvents() {
    // Thumb selection
    const thumbBoxes = this.container.querySelectorAll('.editor-thumb-box');
    thumbBoxes.forEach((box) => {
      box.addEventListener('click', (e) => {
        if (e.target.closest('.editor-thumb-delete')) return;
        const idx = parseInt(box.dataset.index, 10);
        if (this.activeIndex !== idx) {
          this.activeIndex = idx;
          this.updateThumbnails();
        }
      });
    });

    // Thumb delete
    const deleteBtns = this.container.querySelectorAll('.editor-thumb-delete');
    deleteBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const delIdx = parseInt(btn.dataset.deleteIndex, 10);
        this.items.splice(delIdx, 1);
        if (this.activeIndex >= this.items.length) {
          this.activeIndex = Math.max(0, this.items.length - 1);
        }
        if (this.items.length === 0) {
          this.close();
        } else {
          this.updateThumbnails();
        }
      });
    });

    // Add More photos button
    const addMoreBtn = this.container.querySelector('#btn-editor-add-more');
    const fileInput = this.container.querySelector('#editor-add-more-input');
    if (addMoreBtn && fileInput) {
      addMoreBtn.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.addFiles(Array.from(e.target.files));
          fileInput.value = '';
        }
      });
    }
  }

  close(notifyRouter = true) {
    if (notifyRouter && window.router) {
      window.router.removeOverlay('media-editor-modal');
    }
    if (this.container) {
      this.items.forEach((item) => {
        try {
          URL.revokeObjectURL(item.url);
        } catch (e) {}
      });
      const closingEl = this.container;
      closingEl.classList.add('overlay-closing');
      setTimeout(() => closingEl.remove(), 210);
      this.container = null;
    }
  }
}

