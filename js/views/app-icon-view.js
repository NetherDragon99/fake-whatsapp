// Screen: App Icon Selection View (3-Column Grid matching WhatsApp App Icon Screen)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { APP_ICONS, getAppIcon, applyAppIcon } from '../config/app-icons.js';
import { assetUrl, getBasePath } from '../config/base-path.js';
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

        <!-- Pinned Bottom Action Bar -->
        <footer class="app-icon-action-bar">
          <button type="button" class="btn-app-icon-browser" id="btn-open-in-browser">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            <span>Open in Browser</span>
          </button>
          <button type="button" class="btn-app-icon-info" id="btn-icon-reinstall-info" aria-label="How to change icon on home screen">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </button>
        </footer>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Back navigation
    this.container.querySelector('#btn-app-icon-back').addEventListener('click', () => {
      this.router.back();
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

    // Bottom Action: Open in Browser
    const browserBtn = this.container.querySelector('#btn-open-in-browser');
    if (browserBtn) {
      browserBtn.addEventListener('click', () => {
        this.openAppInBrowser();
      });
    }

    // Bottom Action: Reinstall Info Modal
    const infoBtn = this.container.querySelector('#btn-icon-reinstall-info');
    if (infoBtn) {
      infoBtn.addEventListener('click', () => {
        this.showReinstallInstructionsModal();
      });
    }
  }

  openAppInBrowser() {
    const cleanUrl = window.location.origin + getBasePath();
    try {
      const opened = window.open(cleanUrl, '_blank');
      if (!opened || opened.closed || typeof opened.closed === 'undefined') {
        window.location.href = cleanUrl;
      } else {
        Toast.show('Opening app in browser...');
      }
    } catch (e) {
      window.location.href = cleanUrl;
    }
  }

  showReinstallInstructionsModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay custom-dialog-overlay active app-icon-info-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="custom-dialog-card app-icon-info-card">
        <div class="app-icon-info-header">
          <div class="app-icon-info-icon-badge">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </div>
          <h3 class="app-icon-info-title">Change Home Screen Icon</h3>
        </div>

        <p class="app-icon-info-lead">
          Browsers keep home screen icons fixed once installed. To update your home screen shortcut to your newly chosen icon:
        </p>

        <div class="app-icon-info-steps">
          <div class="app-icon-step-item">
            <span class="app-icon-step-num">1</span>
            <div class="app-icon-step-text">
              <strong>Remove Old Shortcut:</strong> Touch and hold the WhatsApp clone icon on your home screen, then tap <strong>Uninstall</strong> or go to the app info to unistall the app.
            </div>
          </div>
          <div class="app-icon-step-item">
            <span class="app-icon-step-num">2</span>
            <div class="app-icon-step-text">
              <strong>Open in Browser:</strong> Tap the <strong>Open in Browser</strong> button below to open this app directly in Chrome, Safari, or your default browser.
            </div>
          </div>
          <div class="app-icon-step-item">
            <span class="app-icon-step-num">3</span>
            <div class="app-icon-step-text">
              <strong>Reinstall with New Icon:</strong> Tap the browser menu (⋮ or Share) and select <strong>"Add to Home screen"</strong> or <strong>"Install App"</strong>.
            </div>
          </div>
        </div>

        <div class="app-icon-safety-box">
          <div class="app-icon-safety-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
            </svg>
          </div>
          <div class="app-icon-safety-content">
            <strong>Your Data is 100% Safe</strong>
            Deleting the home screen shortcut will NOT delete or affect your chats, media, voice notes, or settings. Everything remains safely preserved on your device.
          </div>
        </div>

        <div class="custom-dialog-actions app-icon-modal-actions">
          <button type="button" class="dialog-btn dialog-btn-cancel" id="btn-close-icon-info">Got it</button>
          <button type="button" class="dialog-btn dialog-btn-confirm" id="btn-modal-open-browser" style="background: var(--app-accent, #25d366); color: #0b141a; font-weight: 600;">
            Open in Browser
          </button>
        </div>
      </div>
    `;

    const close = () => {
      document.removeEventListener('keydown', onKeyDown);
      overlay.classList.remove('active');
      overlay.style.opacity = '0';
      if (this.router) {
        this.router.removeOverlay('app-icon-info-modal');
      }
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelector('#btn-close-icon-info').addEventListener('click', close);
    overlay.querySelector('#btn-modal-open-browser').addEventListener('click', () => {
      close();
      this.openAppInBrowser();
    });

    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);

    if (this.router) {
      this.router.pushOverlay('app-icon-info-modal', close);
    }
  }
}
