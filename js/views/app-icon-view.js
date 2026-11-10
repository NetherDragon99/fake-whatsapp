// Screen: App Icon Selection View (3-Column Grid matching WhatsApp App Icon Screen)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { APP_ICONS, getAppIcon, applyAppIcon } from '../config/app-icons.js';
import { assetUrl } from '../config/base-path.js';
import { Toast } from '../components/toast.js';

export class AppIconView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.currentIconId = 'icon-1';
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.currentIconId = await db.getSetting('app_icon_id', 'icon-1');

    const iconsHtml = APP_ICONS.map((icon) => {
      const isSelected = icon.id === this.currentIconId;
      return `
        <button type="button" class="app-icon-tile ${isSelected ? 'selected' : ''}" data-id="${icon.id}" aria-label="${icon.name}">
          <div class="app-icon-ring">
            <img src="${assetUrl(icon.file)}" alt="${icon.name}" class="app-icon-circle-img" loading="lazy" />
            <div class="app-icon-check-badge">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
          </div>
        </button>
      `;
    }).join('');

    rootEl.innerHTML = `
      <div class="screen-view app-icon-screen">
        <!-- App Bar matching WhatsApp reference -->
        <header class="wa-app-bar flat-app-bar">
          <button type="button" class="app-bar-icon-btn" id="btn-app-icon-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="app-title">App icon</div>
          <button type="button" class="app-bar-icon-btn" id="btn-app-icon-menu" aria-label="More options">
            ${Icons.moreVert('', 22)}
          </button>
        </header>

        <!-- Main Body: 3-Column Grid of Icons -->
        <div class="app-icon-body">
          <div class="app-icon-grid">
            ${iconsHtml}
          </div>

          <!-- Bottom Info / Status Bar as agreed in grill-me interview -->
          <div class="app-icon-bottom-bar">
            <div class="app-icon-bottom-sub">Change your app icon to customize your home screen.</div>
            <div class="app-icon-status-pill">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              </svg>
              <span>App icon preference saved</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Back navigation
    this.container.querySelector('#btn-app-icon-back').addEventListener('click', () => {
      this.router.navigate('#/settings/appearance');
    });

    // Overflow menu (simple toast or info)
    const menuBtn = this.container.querySelector('#btn-app-icon-menu');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        Toast.show('Tap any icon to apply it to your app');
      });
    }

    // Icon selection
    const tiles = this.container.querySelectorAll('.app-icon-tile');
    tiles.forEach((tile) => {
      tile.addEventListener('click', async () => {
        const iconId = tile.dataset.id;
        if (this.currentIconId === iconId) return;

        this.currentIconId = iconId;

        // Update UI selection ring
        tiles.forEach((t) => t.classList.remove('selected'));
        tile.classList.add('selected');

        // Persist setting in DB
        await db.setSetting('app_icon_id', iconId);

        // Apply globally to favicon, apple touch icon, and manifest
        await applyAppIcon(iconId);

        const icon = getAppIcon(iconId);
        Toast.show(`App icon changed to ${icon.name}`);
      });
    });
  }
}
