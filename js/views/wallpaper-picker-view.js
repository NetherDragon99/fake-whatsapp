// Screen: Wallpaper Picker (Stage 1 of Wallpaper & Theme setup)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { WALLPAPER_PRESETS } from '../config/wallpapers.js';
import { APP_COLOR_PALETTE } from '../config/palette.js';
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

    // Filter presets by category
    const defaultPresets = WALLPAPER_PRESETS.filter((p) => p.category === 'default');
    const naturePresets = WALLPAPER_PRESETS.filter((p) => p.category === 'nature');
    const vibrantPresets = WALLPAPER_PRESETS.filter((p) => p.category === 'vibrant');

    rootEl.innerHTML = `
      <div class="screen-view wallpaper-picker-screen">
        <header class="wa-app-bar flat-app-bar">
          <button type="button" class="app-bar-icon-btn" id="btn-wp-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="app-title">Wallpaper</div>
        </header>

        <div class="wallpaper-picker-body">
          <!-- Recent Section (Hidden if empty) -->
          <div class="wp-section wp-recent-section" id="wp-recent-section" style="${recentWallpapers.length === 0 ? 'display: none;' : ''}">
            <div class="wp-section-title">Recent</div>
            <div class="wp-recent-strip" id="wp-recent-strip">
              ${recentWallpapers.map((id) => this.renderRecentItem(id)).join('')}
            </div>
          </div>

          <!-- Quick Action Buttons: Gallery & Solid Colours -->
          <div class="wp-quick-actions">
            <label class="wp-action-tile" id="tile-gallery" title="Choose from gallery">
              <input type="file" id="wp-gallery-input" accept="image/*" style="display:none;" />
              <div class="wp-action-circle bg-gallery">
                ${Icons.gallery('', 26)}
              </div>
              <span class="wp-action-label">Gallery</span>
            </label>

            <button type="button" class="wp-action-tile" id="tile-colours" title="Solid colours">
              <div class="wp-action-circle bg-colours">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                  <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.28 19.64 10.59 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
                </svg>
              </div>
              <span class="wp-action-label">Solid colours</span>
            </button>
          </div>

          <!-- Solid Colours Grid Drawer (Collapsible) -->
          <div class="wp-section wp-colours-section" id="wp-colours-container" style="display: none;">
            <div class="wp-section-title">Solid colours</div>
            <div class="wp-swatch-grid">
              ${APP_COLOR_PALETTE.map((hex) => `
                <button type="button" class="wp-colour-swatch" data-color="${hex}" style="background-color: ${hex};" aria-label="Color ${hex}"></button>
              `).join('')}
            </div>
          </div>

          <!-- Default Wallpaper Section -->
          <div class="wp-section">
            <div class="wp-section-title">Default</div>
            <div class="wp-preset-grid">
              ${defaultPresets.map((p) => this.renderPresetCard(p)).join('')}
            </div>
          </div>

          <!-- Nature Wallpapers Section -->
          <div class="wp-section">
            <div class="wp-section-title">Nature</div>
            <div class="wp-preset-grid">
              ${naturePresets.map((p) => this.renderPresetCard(p)).join('')}
            </div>
          </div>

          <!-- Vibrant Wallpapers Section -->
          <div class="wp-section">
            <div class="wp-section-title">Vibrant</div>
            <div class="wp-preset-grid">
              ${vibrantPresets.map((p) => this.renderPresetCard(p)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderRecentItem(id) {
    if (id.startsWith('color:')) {
      const color = id.replace('color:', '');
      return `
        <button type="button" class="wp-recent-item" data-id="${id}" style="background-color: ${color};" title="Color ${color}">
          <span class="recent-label">Solid</span>
        </button>
      `;
    }
    const preset = WALLPAPER_PRESETS.find((p) => p.id === id);
    if (!preset || !preset.file) {
      return `
        <button type="button" class="wp-recent-item wp-default-card" data-id="${id}">
          <span class="recent-label">${preset ? preset.label : id}</span>
        </button>
      `;
    }
    const fullUrl = assetUrl(preset.file);
    return `
      <button type="button" class="wp-recent-item" data-id="${id}">
        <img src="${fullUrl}" loading="lazy" decoding="async" alt="${preset.label}" class="recent-thumb" onerror="this.onerror=null; this.style.display='none'; this.parentElement.style.backgroundColor='${APP_COLOR_PALETTE[0]}'; console.warn('Missing wallpaper asset:', '${preset.file}');" />
        <span class="recent-label">${preset.label}</span>
      </button>
    `;
  }

  renderPresetCard(preset) {
    if (!preset.file) {
      return `
        <button type="button" class="wp-preset-card wp-default-card" data-id="${preset.id}">
          <div class="default-doodle-bg"></div>
          <span class="wp-preset-label">${preset.label}</span>
        </button>
      `;
    }
    const fullUrl = assetUrl(preset.file);
    return `
      <button type="button" class="wp-preset-card" data-id="${preset.id}">
        <img src="${fullUrl}" loading="lazy" decoding="async" alt="${preset.label}" class="wp-preset-thumb" onerror="this.onerror=null; this.style.display='none'; this.parentElement.style.backgroundColor='${APP_COLOR_PALETTE[0]}'; console.warn('Missing wallpaper asset:', '${preset.file}');" />
        <span class="wp-preset-label">${preset.label}</span>
      </button>
    `;
  }

  bindEvents() {
    // Back button
    this.container.querySelector('#btn-wp-back').addEventListener('click', () => {
      window.history.back();
    });

    // Toggle solid colours drawer
    const coloursTile = this.container.querySelector('#tile-colours');
    const coloursContainer = this.container.querySelector('#wp-colours-container');
    coloursTile.addEventListener('click', () => {
      const isVisible = coloursContainer.style.display !== 'none';
      coloursContainer.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        coloursContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    // Swatch clicks
    this.container.querySelectorAll('.wp-colour-swatch').forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const hex = swatch.dataset.color;
        this.openPreview(`color:${hex}`);
      });
    });

    // Gallery upload input
    const galleryInput = this.container.querySelector('#wp-gallery-input');
    galleryInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        // Store temporary custom preview Blob in IndexedDB or memory
        const tempKey = 'temp_preview_wallpaper';
        await db.setSetting(tempKey, file);
        this.openPreview('custom');
      }
    });

    // Preset cards and Recent items clicks
    this.container.querySelectorAll('.wp-preset-card, .wp-recent-item').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        if (id) this.openPreview(id);
      });
    });
  }

  openPreview(id) {
    const query = new URLSearchParams();
    query.set('id', id);
    query.set('scope', this.scope);
    if (this.chatId) query.set('chatId', this.chatId);
    this.router.navigate(`#/theme-preview?${query.toString()}`);
  }
}
