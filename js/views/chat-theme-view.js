// Main Chat Theme Selection View with Top Actions (Chat bubble & Wallpaper) and Preset Theme Categories
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { assetUrl } from '../config/base-path.js';

export class ChatThemeView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.themeData = null;
  }

  async loadThemes() {
    try {
      const resp = await fetch(assetUrl('assets/data/chat-themes.json'));
      if (resp.ok) {
        this.themeData = await resp.json();
        return;
      }
    } catch (e) {
      console.warn('[ChatThemeView] Could not fetch chat-themes.json, using bundled presets:', e);
    }

    // Bundled fallback presets
    this.themeData = {
      categories: [
        {
          id: 'featured',
          name: 'Featured',
          items: [
            { id: 'feat-1', name: 'Golden Horizon', wallpaper: 'assets/wallpapers/nature-8.webp', bubbleColor: '#8c3d23' },
            { id: 'feat-2', name: 'Lush Tropic', wallpaper: 'assets/wallpapers/nature-1.webp', bubbleColor: '#2d6a4f' },
            { id: 'feat-3', name: 'Sunny Glow', wallpaper: 'assets/wallpapers/vibrant-2.webp', bubbleColor: '#205068' },
            { id: 'feat-4', name: 'Cosmic Fluid', wallpaper: 'assets/wallpapers/vibrant-10.webp', bubbleColor: '#55585f' }
          ]
        },
        {
          id: 'nature',
          name: 'Nature',
          items: [
            { id: 'nat-1', name: 'Monument Valley', wallpaper: 'assets/wallpapers/nature-5.webp', bubbleColor: '#8c3d23' },
            { id: 'nat-2', name: 'Sunset Shore', wallpaper: 'assets/wallpapers/nature-6.webp', bubbleColor: '#5b21b6' },
            { id: 'nat-3', name: 'Glacier Peaks', wallpaper: 'assets/wallpapers/nature-4.webp', bubbleColor: '#3b6998' },
            { id: 'nat-4', name: 'Autumn Ridge', wallpaper: 'assets/wallpapers/nature-3.webp', bubbleColor: '#660c14' }
          ]
        },
        {
          id: 'minimal',
          name: 'Minimal',
          items: [
            { id: 'min-1', name: 'Midnight Slate', wallpaper: 'color:#111b21', bubbleColor: '#3b6998' },
            { id: 'min-2', name: 'Berry Velvet', wallpaper: 'color:#121212', bubbleColor: '#be123c' },
            { id: 'min-3', name: 'Emerald Night', wallpaper: 'color:#0b141a', bubbleColor: '#2d6a4f' },
            { id: 'min-4', name: 'Terracotta Dark', wallpaper: 'color:#1f1b18', bubbleColor: '#c2410c' }
          ]
        },
        {
          id: 'doodle',
          name: 'Doodle',
          items: [
            { id: 'doodle-1', name: 'Classic Forest', wallpaper: 'default', bubbleColor: '#25d366' },
            { id: 'doodle-2', name: 'Teal Lagoon', wallpaper: 'default', bubbleColor: '#0d9488' },
            { id: 'doodle-3', name: 'Warm Spice', wallpaper: 'default', bubbleColor: '#c2410c' },
            { id: 'doodle-4', name: 'Olive Mist', wallpaper: 'default', bubbleColor: '#4d7c0f' }
          ]
        }
      ]
    };
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    await this.loadThemes();

    const categoriesHtml = this.themeData.categories.map((cat) => this.renderCategory(cat)).join('');

    rootEl.innerHTML = `
      <div class="screen-view chat-theme-screen">
        <header class="wa-app-bar flat-app-bar">
          <button type="button" class="app-bar-icon-btn" id="btn-chat-theme-back" aria-label="Go back">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="app-title">Chat theme</div>
        </header>

        <div class="chat-theme-body">
          <!-- Top Two Sleek Action Card Pills: Chat Bubble & Wallpaper -->
          <div class="theme-top-actions">
            <button type="button" class="theme-action-pill" id="btn-top-chat-bubble" aria-label="Customize chat bubble color">
              <div class="theme-pill-icon bubble-pill-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <div class="theme-pill-text">
                <span class="theme-pill-title">Chat bubble</span>
                <span class="theme-pill-subtitle">Color palette</span>
              </div>
            </button>

            <button type="button" class="theme-action-pill" id="btn-top-wallpaper" aria-label="Change wallpaper">
              <div class="theme-pill-icon wallpaper-pill-icon">
                ${Icons.gallery('', 22)}
              </div>
              <div class="theme-pill-text">
                <span class="theme-pill-title">Wallpaper</span>
                <span class="theme-pill-subtitle">Photos & styles</span>
              </div>
            </button>
          </div>

          <!-- Categorized Preset Themes List -->
          <div class="theme-categories-list">
            ${categoriesHtml}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderCategory(cat) {
    const itemsHtml = cat.items.map((item) => {
      let bgStyle = '';
      if (item.wallpaper.startsWith('color:')) {
        bgStyle = `background-color: ${item.wallpaper.replace('color:', '')};`;
      } else if (item.wallpaper === 'default') {
        bgStyle = 'background-color: #0b141a;';
      } else {
        bgStyle = `background-image: url('${assetUrl(item.wallpaper)}'); background-size: cover; background-position: center;`;
      }

      return `
        <div class="theme-card-wrap" data-wallpaper="${item.wallpaper}" data-bubble-color="${item.bubbleColor}">
          <div class="theme-preview-card" style="${bgStyle}">
            <div class="card-mini-bubble card-bubble-incoming"></div>
            <div class="card-mini-bubble card-bubble-outgoing" style="background-color: ${item.bubbleColor};"></div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="theme-category-section">
        <div class="theme-category-header">
          <span class="theme-category-title">${cat.name}</span>
        </div>
        <div class="theme-category-scroll-track">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.container.querySelector('#btn-chat-theme-back').addEventListener('click', () => {
      this.router.back();
    });

    this.container.querySelector('#btn-top-chat-bubble').addEventListener('click', () => {
      this.router.navigate('#/chat-bubble-picker');
    });

    this.container.querySelector('#btn-top-wallpaper').addEventListener('click', () => {
      this.router.navigate('#/wallpaper-picker');
    });

    const cards = this.container.querySelectorAll('.theme-card-wrap');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const wp = card.dataset.wallpaper;
        const bubble = card.dataset.bubbleColor;
        this.router.navigate(`#/theme-preview?wallpaper=${encodeURIComponent(wp)}&bubbleColor=${encodeURIComponent(bubble)}`);
      });
    });
  }
}
