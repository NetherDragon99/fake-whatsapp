// Component: Resizable Bottom Sticker Drawer with Drag Handle & Reusable Chat Stickers
import { db } from '../db.js';
import { assetUrl } from '../config/base-path.js';
import { DrawerResizer } from '../utils/drawer-resizer.js';

export class StickerDrawer {
  constructor(options = {}) {
    this.onSelectSticker = options.onSelectSticker || (() => {});
    this.container = null;
    this.drawerEl = null;
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
    // Note: DrawerResizer.open() handles window.router.pushOverlay via overlayId
    await this.render();
  }

  close(notifyRouter = true) {
    if (this.resizer && this.resizer.isOpen) {
      // DrawerResizer.close() will call onClose which cleans up the DOM elements
      this.resizer.close(notifyRouter);
      return;
    }
    // Fallback if resizer not yet initialized
    if (notifyRouter && window.router) {
      window.router.removeOverlay('sticker-drawer');
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    if (this.drawerEl) {
      this.drawerEl.remove();
      this.drawerEl = null;
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
    const existingOverlay = document.querySelector('.sticker-drawer-overlay');
    if (existingOverlay) existingOverlay.remove();
    const existingDrawer = document.querySelector('.sticker-drawer-sheet');
    if (existingDrawer) existingDrawer.remove();

    const stickers = await this.loadAllStickers();

    const overlay = document.createElement('div');
    overlay.className = 'sticker-drawer-overlay';
    overlay.style.display = 'none';

    const drawer = document.createElement('div');
    drawer.className = 'sticker-drawer-sheet';
    drawer.style.display = 'none';

    drawer.innerHTML = `
      <!-- Fullscreen Header (active when dragged > 80%) -->
      <div class="sheet-fullscreen-header" id="sticker-fullscreen-header" style="display:none;">
        <button type="button" class="sheet-fullscreen-back-btn" id="btn-sticker-fullscreen-back" aria-label="Exit fullscreen">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <div class="sheet-fullscreen-title">Stickers</div>
      </div>

      <!-- Top Drag Handle (kept visible in both normal & fullscreen mode) -->
      <div class="drawer-drag-header" id="drawer-drag-header">
        <div class="drawer-drag-handle-bar"></div>
        <div class="drawer-header-title">Stickers</div>
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

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    this.container = overlay;
    this.drawerEl = drawer;

    // Initialize Universal Drawer Resizer (opens to 40% from bottom)
    this.resizer = new DrawerResizer({
      sheet: drawer,
      handle: drawer.querySelector('#drawer-drag-header'),
      backdrop: overlay,
      fullscreenHeader: drawer.querySelector('#sticker-fullscreen-header'),
      overlayId: 'sticker-drawer',
      defaultHeightVh: 40,
      minVh: 20,
      maxVh: 80,
      onClose: () => {
        if (this.container) {
          this.container.remove();
          this.container = null;
        }
        if (this.drawerEl) {
          this.drawerEl.remove();
          this.drawerEl = null;
        }
        this.isOpen = false;
      },
      onResize: (px, vh) => {
        this.currentHeightVh = Math.round(vh);
      }
    });

    this.resizer.open(40);

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

