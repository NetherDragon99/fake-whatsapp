// Screen: WhatsApp Native Wallpaper Hub (4 Sections: Actions, Last Used, Nature, Vibrant)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { WALLPAPER_PRESETS } from '../config/wallpapers.js';
import { assetUrl } from '../config/base-path.js';

export class WallpaperPickerView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.scope = 'global';
    this.chatId = null;
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.scope = params.scope || 'global';
    this.chatId = params.chatId || null;

    const recentWallpapers = await db.getSetting('recent_wallpapers', []);

    // Filter presets
    const naturePresets = WALLPAPER_PRESETS.filter((p) => p.category === 'nature');
    const vibrantPresets = WALLPAPER_PRESETS.filter((p) => p.category === 'vibrant');

    // Prepare Last Used items (including default nature-8 if empty so it looks like WhatsApp reference)
    const lastUsedItems = [];
    if (recentWallpapers.length > 0) {
      for (const id of recentWallpapers) {
        if (id === 'custom') {
          const blob = await db.getSetting('temp_preview_wallpaper', null);
          if (blob) lastUsedItems.push({ id: 'custom', blob, label: 'Custom' });
        } else {
          const p = WALLPAPER_PRESETS.find((x) => x.id === id);
          if (p) lastUsedItems.push(p);
        }
      }
    } else {
      // Default initial last-used cards matching reference image 3
      const defaultRecents = [WALLPAPER_PRESETS[14], WALLPAPER_PRESETS[23]].filter(Boolean);
      lastUsedItems.push(...defaultRecents);
    }

    rootEl.innerHTML = `
      <div class="screen-view wallpaper-picker-screen">
        <header class="wa-app-bar flat-app-bar">
          <button type="button" class="app-bar-icon-btn" id="btn-wp-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="app-title">Wallpaper</div>
        </header>

        <div class="wallpaper-picker-body">
          <!-- Section 1 (Top): Sleek Action Card Pills (Gallery & Colour) -->
          <div class="wp-top-action-buttons">
            <label class="theme-action-pill" id="btn-wp-gallery" title="Gallery" aria-label="Upload photo from gallery">
              <input type="file" id="wp-gallery-file-input" accept="image/*" style="display:none;" />
              <div class="theme-pill-icon gallery-pill-icon">
                ${Icons.gallery('', 22)}
              </div>
              <div class="theme-pill-text">
                <span class="theme-pill-title">Gallery</span>
                <span class="theme-pill-subtitle">Custom photo</span>
              </div>
            </label>

            <button type="button" class="theme-action-pill" id="btn-wp-solid-colours" title="Solid colours" aria-label="Pick solid colour">
              <div class="theme-pill-icon colours-pill-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.28 19.64 10.59 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
                </svg>
              </div>
              <div class="theme-pill-text">
                <span class="theme-pill-title">Colour</span>
                <span class="theme-pill-subtitle">Solid tints</span>
              </div>
            </button>
          </div>

          <!-- Section 2: Last used (Horizontal Scroll, Clickable Title) -->
          <div class="wp-category-section">
            <div class="wp-category-header clickable" id="header-last-used" title="View all Last used in grid">
              <span class="wp-category-name">Last used</span>
              <span class="wp-chevron-icon">${Icons.chevronRight ? Icons.chevronRight('', 18) : '&gt;'}</span>
            </div>
            <div class="wp-horizontal-scroll-track" id="track-last-used">
              ${lastUsedItems.map((item) => this.renderWallpaperCard(item)).join('')}
            </div>
          </div>

          <!-- Section 3: Nature (Horizontal Scroll, Clickable Title) -->
          <div class="wp-category-section">
            <div class="wp-category-header clickable" id="header-nature" title="View all Nature in grid">
              <span class="wp-category-name">Nature</span>
              <span class="wp-chevron-icon">${Icons.chevronRight ? Icons.chevronRight('', 18) : '&gt;'}</span>
            </div>
            <div class="wp-horizontal-scroll-track" id="track-nature">
              ${naturePresets.map((item) => this.renderWallpaperCard(item)).join('')}
            </div>
          </div>

          <!-- Section 4: Vibrant (Horizontal Scroll, Clickable Title) -->
          <div class="wp-category-section">
            <div class="wp-category-header clickable" id="header-vibrant" title="View all Vibrant in grid">
              <span class="wp-category-name">Vibrant</span>
              <span class="wp-chevron-icon">${Icons.chevronRight ? Icons.chevronRight('', 18) : '&gt;'}</span>
            </div>
            <div class="wp-horizontal-scroll-track" id="track-vibrant">
              ${vibrantPresets.map((item) => this.renderWallpaperCard(item)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderWallpaperCard(item) {
    let src = '';
    if (item.blob) {
      src = URL.createObjectURL(item.blob);
    } else if (item.file) {
      src = assetUrl(item.file);
    }

    return `
      <button type="button" class="wp-horizontal-card" data-id="${item.id}" aria-label="${item.label || item.id}">
        ${src ? `<img src="${src}" alt="${item.label || ''}" class="wp-card-thumb" loading="lazy" />` : `<div class="wp-card-placeholder"></div>`}
      </button>
    `;
  }

  bindEvents() {
    this.container.querySelector('#btn-wp-back').addEventListener('click', () => {
      this.router.back();
    });

    // Gallery File Picker
    const galleryInput = this.container.querySelector('#wp-gallery-file-input');
    galleryInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        await db.setSetting('temp_preview_wallpaper', file);

        // Add 'custom' to recent_wallpapers
        const recents = await db.getSetting('recent_wallpapers', []);
        const filtered = recents.filter((r) => r !== 'custom');
        filtered.unshift('custom');
        await db.setSetting('recent_wallpapers', filtered.slice(0, 6));

        this.router.navigate('#/theme-preview?wallpaper=custom');
      }
    });

    // Solid Colours
    this.container.querySelector('#btn-wp-solid-colours').addEventListener('click', () => {
      this.router.navigate('#/solid-colours-picker');
    });

    // Section Title Clicks -> Open Grid Mode
    this.container.querySelector('#header-last-used').addEventListener('click', () => {
      this.router.navigate('#/wallpaper-section?category=last-used');
    });

    this.container.querySelector('#header-nature').addEventListener('click', () => {
      this.router.navigate('#/wallpaper-section?category=nature');
    });

    this.container.querySelector('#header-vibrant').addEventListener('click', () => {
      this.router.navigate('#/wallpaper-section?category=vibrant');
    });

    // Wallpaper card clicks
    const cards = this.container.querySelectorAll('.wp-horizontal-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.router.navigate(`#/theme-preview?wallpaper=${encodeURIComponent(id)}`);
      });
    });
  }
}
