// Screen: Full Grid View for a specific Wallpaper Section (Nature, Vibrant, Last used)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { WALLPAPER_PRESETS } from '../config/wallpapers.js';
import { assetUrl } from '../config/base-path.js';

export class WallpaperSectionView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.category = 'nature';
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.category = params.category || 'nature';

    let title = 'Wallpapers';
    let items = [];

    if (this.category === 'last-used') {
      title = 'Last used';
      const recentIds = await db.getSetting('recent_wallpapers', []);
      for (const id of recentIds) {
        if (typeof id === 'string') {
          if (id.startsWith('custom_blob_') || id === 'custom') {
            const blob = await db.getSetting('temp_preview_wallpaper', null);
            if (blob) items.push({ id: 'custom', blob, label: 'Custom' });
          } else {
            const preset = WALLPAPER_PRESETS.find((p) => p.id === id);
            if (preset) items.push(preset);
          }
        }
      }
    } else if (this.category === 'vibrant') {
      title = 'Vibrant';
      items = WALLPAPER_PRESETS.filter((p) => p.category === 'vibrant');
    } else {
      title = 'Nature';
      items = WALLPAPER_PRESETS.filter((p) => p.category === 'nature');
    }

    const cardsHtml = items.map((item) => {
      let src = '';
      if (item.blob) {
        src = URL.createObjectURL(item.blob);
      } else if (item.file) {
        src = assetUrl(item.file);
      }

      return `
        <button type="button" class="section-grid-card" data-id="${item.id}" aria-label="${item.label || item.id}">
          ${src ? `<img src="${src}" alt="${item.label || ''}" class="section-grid-img" loading="lazy" />` : `<div class="section-grid-placeholder"></div>`}
        </button>
      `;
    }).join('');

    rootEl.innerHTML = `
      <div class="screen-view wallpaper-section-screen">
        <header class="wa-app-bar flat-app-bar">
          <button type="button" class="app-bar-icon-btn" id="btn-section-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="app-title">${title}</div>
        </header>

        <div class="wallpaper-section-body">
          <div class="wallpaper-section-grid">
            ${cardsHtml.length > 0 ? cardsHtml : `<div class="empty-section-notice">No wallpapers found in this category.</div>`}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btn-section-back').addEventListener('click', () => {
      this.router.navigate('#/wallpaper-picker');
    });

    const cards = this.container.querySelectorAll('.section-grid-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.router.navigate(`#/theme-preview?wallpaper=${encodeURIComponent(id)}`);
      });
    });
  }
}

