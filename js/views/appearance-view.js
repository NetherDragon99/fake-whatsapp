// Screen: Appearance & App Theme Settings (Sub-screens of Settings)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { APP_COLOR_PALETTE, applyAppAccent } from '../config/palette.js';
import { WALLPAPER_PRESETS } from '../config/wallpapers.js';
import { getAppIcon } from '../config/app-icons.js';
import { assetUrl } from '../config/base-path.js';
import { Toast } from '../components/toast.js';

export class AppearanceView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.subRoute = ''; // '' for #/settings/appearance, 'theme' for #/settings/appearance/theme
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.subRoute = params.subRoute || '';

    if (this.subRoute === 'theme') {
      await this.renderAppThemeScreen(rootEl);
    } else {
      await this.renderAppearanceRoot(rootEl);
    }
  }

  // --- Sub-Screen 1: Appearance Main (#/settings/appearance) ---
  async renderAppearanceRoot(rootEl) {
    const defaultWp = await db.getSetting('defaultWallpaper', 'default');
    const currentAccent = await db.getSetting('appAccentColor', '#25d366');
    const defaultDimming = await db.getSetting('defaultDimming', 0);
    const currentAppIconId = await db.getSetting('app_icon_id', 'icon-1');
    const currentAppIcon = getAppIcon(currentAppIconId);

    // Find thumbnail for default wallpaper
    let thumbHtml = `<div class="theme-mini-thumb default-thumb"></div>`;
    if (defaultWp.startsWith('color:')) {
      const col = defaultWp.replace('color:', '');
      thumbHtml = `<div class="theme-mini-thumb" style="background-color: ${col};"></div>`;
    } else {
      const preset = WALLPAPER_PRESETS.find((p) => p.id === defaultWp);
      if (preset && preset.file) {
        thumbHtml = `<img src="${assetUrl(preset.file)}" class="theme-mini-thumb" alt="Theme" />`;
      }
    }

    rootEl.innerHTML = `
      <div class="screen-view appearance-screen">
        <header class="wa-app-bar flat-app-bar">
          <button type="button" class="app-bar-icon-btn" id="btn-appearance-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="app-title">Appearance</div>
        </header>

        <div class="appearance-body">
          <!-- Row 1: Default chat theme -->
          <div class="appearance-row" id="row-chat-theme">
            <div class="appearance-row-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.28 19.64 10.59 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
              </svg>
            </div>
            <div class="appearance-row-text">
              <div class="appearance-row-title">Default chat theme</div>
              <div class="appearance-row-subtitle">Wallpaper, dimming, and bubble colors</div>
            </div>
            <div class="appearance-row-right">
              ${thumbHtml}
            </div>
          </div>

          <!-- Row 2: App icon -->
          <div class="appearance-row" id="row-app-icon">
            <div class="appearance-row-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>
              </svg>
            </div>
            <div class="appearance-row-text">
              <div class="appearance-row-title">App icon</div>
              <div class="appearance-row-subtitle">Choose how WhatsApp looks on your home screen</div>
            </div>
            <div class="appearance-row-right">
              <img src="${assetUrl(currentAppIcon.file)}" class="app-icon-mini-thumb" alt="Icon" />
            </div>
          </div>

          <!-- Row 3: App theme -->
          <div class="appearance-row" id="row-app-theme">
            <div class="appearance-row-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <div class="appearance-row-text">
              <div class="appearance-row-title">App theme</div>
              <div class="appearance-row-subtitle">Dark mode and accent color</div>
            </div>
            <div class="appearance-row-right">
              <span class="theme-accent-circle" style="background-color: ${currentAccent};"></span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Back button
    rootEl.querySelector('#btn-appearance-back').addEventListener('click', () => {
      this.router.navigate('#/settings');
    });

    // Chat theme click -> Go to Main Chat Theme View
    rootEl.querySelector('#row-chat-theme').addEventListener('click', () => {
      this.router.navigate('#/chat-theme');
    });

    // App icon click -> Go to App Icon Screen
    rootEl.querySelector('#row-app-icon').addEventListener('click', () => {
      this.router.navigate('#/settings/appearance/app-icon');
    });

    // App theme click -> Go to App Theme sub-screen
    rootEl.querySelector('#row-app-theme').addEventListener('click', () => {
      this.router.navigate('#/settings/appearance/theme');
    });
  }

  // --- Sub-Screen 2: App Theme (#/settings/appearance/theme) ---
  async renderAppThemeScreen(rootEl) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const currentAccent = (await db.getSetting('appAccentColor', '#25d366')).toLowerCase();

    rootEl.innerHTML = `
      <div class="screen-view appearance-screen">
        <header class="wa-app-bar flat-app-bar">
          <button type="button" class="app-bar-icon-btn" id="btn-theme-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="app-title">App theme</div>
        </header>

        <div class="appearance-body">
          <!-- Dark mode row -->
          <div class="appearance-row" id="row-toggle-darkmode">
            <div class="appearance-row-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
              </svg>
            </div>
            <div class="appearance-row-text">
              <div class="appearance-row-title">Dark mode</div>
              <div class="appearance-row-subtitle" id="darkmode-status-text">${isLight ? 'Light' : 'Dark'}</div>
            </div>
            <div class="appearance-row-right">
              <label class="switch-wrap">
                <input type="checkbox" id="cb-darkmode" ${!isLight ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <div class="thick-section-divider"></div>

          <!-- Colour section -->
          <div class="app-theme-colour-section">
            <div class="app-theme-colour-heading">Colour</div>
            <div class="app-theme-swatch-grid">
              ${APP_COLOR_PALETTE.map((hex) => {
                const isActive = hex.toLowerCase() === currentAccent;
                return `
                  <button type="button" class="theme-accent-swatch ${isActive ? 'active' : ''}" data-color="${hex}" style="background-color: ${hex};" aria-label="Accent ${hex}">
                    ${isActive ? `
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="#ffffff">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    ` : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Back button
    rootEl.querySelector('#btn-theme-back').addEventListener('click', () => {
      this.router.navigate('#/settings/appearance');
    });

    // Dark mode toggle
    const cbDark = rootEl.querySelector('#cb-darkmode');
    const statusText = rootEl.querySelector('#darkmode-status-text');
    cbDark.addEventListener('change', async () => {
      const isDark = cbDark.checked;
      statusText.textContent = isDark ? 'Dark' : 'Light';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', '#0b141a');
        await db.setSetting('themeMode', 'dark');
        localStorage.setItem('wa_theme_mode', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', '#ffffff');
        await db.setSetting('themeMode', 'light');
        localStorage.setItem('wa_theme_mode', 'light');
      }
      Toast.show(isDark ? 'Dark mode enabled' : 'Light mode enabled');
    });

    // Swatch selection
    rootEl.querySelectorAll('.theme-accent-swatch').forEach((swatch) => {
      swatch.addEventListener('click', async () => {
        const hex = swatch.dataset.color;
        applyAppAccent(hex);
        await db.setSetting('appAccentColor', hex);

        rootEl.querySelectorAll('.theme-accent-swatch').forEach((s) => {
          s.classList.remove('active');
          s.innerHTML = '';
        });
        swatch.classList.add('active');
        swatch.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#ffffff">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        `;
        Toast.show('Accent color updated');
      });
    });
  }

  // --- App Icon Selection Modal ---
  openAppIconDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay app-icon-modal active';

    const currentAccent = document.documentElement.style.getPropertyValue('--app-accent') || '#25d366';

    overlay.innerHTML = `
      <div class="custom-dialog-card app-icon-card" role="dialog" aria-modal="true" aria-labelledby="icon-dialog-title">
        <h3 class="custom-dialog-title" id="icon-dialog-title">Choose app icon</h3>
        
        <div class="app-icon-options-list">
          <label class="app-icon-option-row">
            <input type="radio" name="app-icon-choice" value="official" checked />
            <img src="${assetUrl('assets/icons/icon.svg')}" class="icon-option-img" alt="Official Green" />
            <div class="icon-option-info">
              <div class="icon-option-name">Official Green</div>
              <div class="icon-option-desc">Original WhatsApp Android icon</div>
            </div>
          </label>

          <label class="app-icon-option-row">
            <input type="radio" name="app-icon-choice" value="slate" />
            <div class="icon-option-img icon-slate-bg">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="#53bdeb">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/>
              </svg>
            </div>
            <div class="icon-option-info">
              <div class="icon-option-name">Slate-Blue Dark</div>
              <div class="icon-option-desc">Minimalist midnight tone</div>
            </div>
          </label>

          <label class="app-icon-option-row">
            <input type="radio" name="app-icon-choice" value="accent" />
            <div class="icon-option-img" style="background-color: ${currentAccent};">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="#ffffff">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/>
              </svg>
            </div>
            <div class="icon-option-info">
              <div class="icon-option-name">Dynamic Themed</div>
              <div class="icon-option-desc">Matches your current app accent</div>
            </div>
          </label>
        </div>

        <div class="custom-dialog-actions">
          <button type="button" class="dialog-btn icon-btn-cancel">Cancel</button>
          <button type="button" class="dialog-btn icon-btn-apply">Apply</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup();
    });

    overlay.querySelector('.icon-btn-cancel').addEventListener('click', cleanup);

    overlay.querySelector('.icon-btn-apply').addEventListener('click', async () => {
      const selected = overlay.querySelector('input[name="app-icon-choice"]:checked')?.value || 'official';
      await db.setSetting('appIconChoice', selected);

      // If user selected official, ensure link tags point to assets/icons/icon.svg
      if (selected === 'official') {
        const svgIconLink = document.querySelector('link[type="image/svg+xml"]');
        if (svgIconLink) svgIconLink.href = assetUrl('assets/icons/icon.svg');
        const touchIconLink = document.querySelector('link[rel="apple-touch-icon"]');
        if (touchIconLink) touchIconLink.href = assetUrl('assets/icons/icon.svg');
      }
      cleanup();
      Toast.show('App icon preference saved');
    });
  }
}
