// Component: Resizable 40% Bottom Sticker Drawer with Drag Handle & Reusable Chat Stickers
import { db } from '../db.js';
import { assetUrl } from '../config/base-path.js';

export class StickerDrawer {
  constructor(options = {}) {
    this.onSelectSticker = options.onSelectSticker || (() => {});
    this.container = null;
    this.isOpen = false;
    this.currentHeightVh = 40; // Default 40%
    this.isDragging = false;
    this.startY = 0;
    this.startHeight = 0;
  }

  async open() {
    if (this.isOpen) {
      this.close();
      return;
    }
    this.isOpen = true;
    await this.render();
  }

  close() {
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

    // Close when tapping outside the sheet
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Bind Drag Handle resize events
    this.bindDragResize(drawer);

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

  bindDragResize(drawer) {
    const handle = drawer.querySelector('#drawer-drag-header');
    if (!handle) return;

    const onPointerDown = (e) => {
      this.isDragging = true;
      this.startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      this.startHeight = drawer.getBoundingClientRect().height;
      drawer.style.transition = 'none';

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('touchmove', onPointerMove, { passive: false });
      document.addEventListener('touchend', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      if (e.cancelable) e.preventDefault();

      const currentY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      const deltaY = this.startY - currentY; // Moving up increases height
      const newHeight = this.startHeight + deltaY;

      const vh = window.innerHeight;
      const minHeight = vh * 0.20; // 20%
      const maxHeight = vh * 0.85; // 85%

      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      drawer.style.height = `${clampedHeight}px`;
      this.currentHeightVh = Math.round((clampedHeight / vh) * 100);
    };

    const onPointerUp = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      drawer.style.transition = 'height 0.2s cubic-bezier(0.2, 0, 0, 1)';

      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchend', onPointerUp);
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('touchstart', onPointerDown, { passive: true });
  }
}

