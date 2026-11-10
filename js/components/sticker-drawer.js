// Component: Resizable Bottom Sticker Drawer with Drag Handle & Reusable Chat Stickers
import { db } from '../db.js';
import { assetUrl } from '../config/base-path.js';
import { DrawerResizer } from '../utils/drawer-resizer.js';

export class StickerDrawer {
  constructor(options = {}) {
    this.onSelectSticker = options.onSelectSticker || (() => {});
    this.container = null;
    this.isOpen = false;
    this.currentHeightVh = 40; // Default 40%
    this.resizer = null;
  }

  async open() {
    if (this.isOpen) {
      this.close();
      return;
    }
    this.isOpen = true;
    if (window.router) {
      window.router.pushOverlay('sticker-drawer', () => this.close(false));
    }
    await this.render();
  }

  close(notifyRouter = true) {
    if (notifyRouter && window.router) {
      window.router.removeOverlay('sticker-drawer');
    }
    if (this.container) {
      this.container.classList.remove('active');
      setTimeout(() => {
        if (this.container) {
          this.container.remove();
          this.container = null;
        }
      }, 250);
    }
    this.isOpen = false;
  }

  async loadAllStickers() {
    const stickers = [];

    // 1. Collect all stickers from IndexedDB imported chats
    try {
      await db.init();
      const allMedia = await db.getAllMedia();
      for (const m of allMedia) {
        const isSticker = m.type === 'sticker' ||
                          m.mediaType === 'sticker' ||
                          (m.filename && (/\.webp$/i.test(m.filename) || /stk-/i.test(m.filename) || /sticker/i.test(m.filename))) ||
                          m.mimeType === 'image/webp';
        if (isSticker && m.blob) {
          stickers.push({
            id: m.id || m.mediaId,
            name: m.filename || 'Sticker',
            url: URL.createObjectURL(m.blob),
            blob: m.blob,
            isImported: true
          });
        }
      }
    } catch (e) {
      console.warn('[StickerDrawer] Error fetching imported stickers:', e);
    }

    // 2. Add 12 bundled default WhatsApp stickers
    for (let i = 1; i <= 12; i++) {
      stickers.push({
        id: `default-stk-${i}`,
        name: `Sticker ${i}`,
        url: assetUrl(`assets/stickers/sticker-${i}.svg`),
        isDefault: true
      });
    }

    return stickers;
  }

  async render() {
    const existing = document.querySelector('.sticker-drawer-overlay');
    if (existing) existing.remove();

    const stickers = await this.loadAllStickers();

    const overlay = document.createElement('div');
    overlay.className = 'sticker-drawer-overlay';

    const drawer = document.createElement('div');
    drawer.className = 'sticker-drawer-sheet';
    drawer.style.height = `${this.currentHeightVh}vh`;

    drawer.innerHTML = `
      <!-- Top Drag Handle -->
      <div class="drawer-drag-header" id="drawer-drag-header">
        <div class="drawer-drag-handle-bar"></div>
        <div class="drawer-header-title">Stickers</div>
      </div>

      <!-- Fullscreen Header (active when dragged > 90%) -->
      <div class="sheet-fullscreen-header" id="sticker-fullscreen-header" style="display:none;">
        <button type="button" class="sheet-fullscreen-back-btn" id="btn-sticker-fullscreen-back" aria-label="Exit fullscreen">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <div class="sheet-fullscreen-title">Stickers</div>
      </div>

      <!-- Sticker Grid Body -->
      <div class="drawer-stickers-scroll">
        <div class="stickers-grid">
          ${stickers.map((s, idx) => `
            <button type="button" class="sticker-grid-tile" data-index="${idx}" aria-label="${s.name}">
              <img src="${s.url}" alt="${s.name}" class="sticker-img" loading="lazy" />
            </button>
          `).join('')}
        </div>
      </div>
    `;

    overlay.appendChild(drawer);
    document.body.appendChild(overlay);
    this.container = overlay;

    // Trigger open animation
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    // Initialize Universal Drawer Resizer
    this.resizer = new DrawerResizer({
      sheet: drawer,
      handle: drawer.querySelector('#drawer-drag-header'),
      backdrop: overlay,
      fullscreenHeader: drawer.querySelector('#sticker-fullscreen-header'),
      overlayId: 'sticker-drawer',
      defaultHeightVh: this.currentHeightVh || 40,
      minVh: 20,
      maxVh: 90,
      onClose: () => this.close(false),
      onResize: (px, vh) => {
        this.currentHeightVh = Math.round(vh);
      }
    });

    // Close when tapping outside the sheet
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Bind Sticker selection
    const tiles = drawer.querySelectorAll('.sticker-grid-tile');
    tiles.forEach((tile) => {
      tile.addEventListener('click', async () => {
        const idx = parseInt(tile.dataset.index, 10);
        const selected = stickers[idx];
        if (selected) {
          this.close();
          // Convert URL to blob if default sticker
          let blob = selected.blob;
          if (!blob) {
            try {
              const resp = await fetch(selected.url);
              blob = await resp.blob();
            } catch (err) {
              console.warn('[StickerDrawer] Failed to fetch sticker blob:', err);
            }
          }
          this.onSelectSticker(blob || selected.url, selected.name);
        }
      });
    });
  }
}

