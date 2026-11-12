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

    // Bundled fallback presets (keep in sync with assets/data/chat-themes.json v2.0.0)
    this.themeData = {
      categories: [
        {
          id: 'featured',
          name: 'Featured',
          items: [
            { id: 'feat-1', name: 'Dark Waves',     wallpaper: 'assets/wallpapers/vibrant-14.webp', bubbleColor: '#1a3a5c' },
            { id: 'feat-2', name: 'Joshua Tree',    wallpaper: 'assets/wallpapers/nature-8.webp',   bubbleColor: '#7c3a1e' },
            { id: 'feat-3', name: 'Orange Leaves',  wallpaper: 'assets/wallpapers/nature-1.webp',   bubbleColor: '#c2410c' },
            { id: 'feat-4', name: 'Sunny Glow',     wallpaper: 'assets/wallpapers/vibrant-2.webp',  bubbleColor: '#1d244e' },
            { id: 'feat-5', name: 'Cosmic Fluid',   wallpaper: 'assets/wallpapers/vibrant-10.webp', bubbleColor: '#55585f' },
            { id: 'feat-6', name: 'Neon City',      wallpaper: 'assets/wallpapers/vibrant-13.webp', bubbleColor: '#1a1a3e' },
            { id: 'feat-7', name: 'Aurora Bloom',   wallpaper: 'assets/wallpapers/vibrant-15.webp', bubbleColor: '#3b1f5e' },
            { id: 'feat-8', name: 'Fire Gradient',  wallpaper: 'assets/wallpapers/vibrant-16.webp', bubbleColor: '#7c1a1a' }
          ]
        },
        {
          id: 'nature',
          name: 'Nature',
          items: [
            { id: 'nat-1',  name: 'Palms Coast',        wallpaper: 'assets/wallpapers/nature-5.webp',  bubbleColor: '#57a2a5' },
            { id: 'nat-2',  name: 'Desert Pyramid',     wallpaper: 'assets/wallpapers/nature-6.webp',  bubbleColor: '#632a71' },
            { id: 'nat-3',  name: 'Mountain Sunset',    wallpaper: 'assets/wallpapers/nature-4.webp',  bubbleColor: '#394380' },
            { id: 'nat-4',  name: 'Pink Autumn Tree',   wallpaper: 'assets/wallpapers/nature-3.webp',  bubbleColor: '#6d0f27' },
            { id: 'nat-5',  name: 'Canyon Desert',      wallpaper: 'assets/wallpapers/nature-13.webp', bubbleColor: '#8b2635' },
            { id: 'nat-6',  name: 'Orange Sun Eclipse', wallpaper: 'assets/wallpapers/nature-14.webp', bubbleColor: '#7a3010' },
            { id: 'nat-7',  name: 'Ocean Coast',        wallpaper: 'assets/wallpapers/nature-15.webp', bubbleColor: '#0e4f6b' },
            { id: 'nat-8',  name: 'Desert Highway',     wallpaper: 'assets/wallpapers/nature-16.webp', bubbleColor: '#1a3a6b' },
            { id: 'nat-9',  name: 'Emerald Forest',     wallpaper: 'assets/wallpapers/nature-17.webp', bubbleColor: '#1a4d2e' },
            { id: 'nat-10', name: 'Lavender Fields',    wallpaper: 'assets/wallpapers/nature-18.webp', bubbleColor: '#4a235a' },
            { id: 'nat-11', name: 'Golden Savanna',     wallpaper: 'assets/wallpapers/nature-19.webp', bubbleColor: '#7a4a10' },
            { id: 'nat-12', name: 'Arctic Dawn',        wallpaper: 'assets/wallpapers/nature-20.webp', bubbleColor: '#1c3a5e' }
          ]
        },
        {
          id: 'vibrant',
          name: 'Vibrant',
          items: [
            { id: 'vib-1', name: 'Purple Haze',    wallpaper: 'assets/wallpapers/vibrant-17.webp', bubbleColor: '#4a1570' },
            { id: 'vib-2', name: 'Crimson Storm',  wallpaper: 'assets/wallpapers/vibrant-18.webp', bubbleColor: '#7c1a1a' },
            { id: 'vib-3', name: 'Teal Surge',     wallpaper: 'assets/wallpapers/vibrant-19.webp', bubbleColor: '#0a4a45' },
            { id: 'vib-4', name: 'Golden Rush',    wallpaper: 'assets/wallpapers/vibrant-20.webp', bubbleColor: '#7a5000' },
            { id: 'vib-5', name: 'Midnight Blue',  wallpaper: 'assets/wallpapers/vibrant-21.webp', bubbleColor: '#0d2b6b' },
            { id: 'vib-6', name: 'Rose Quartz',    wallpaper: 'assets/wallpapers/vibrant-22.webp', bubbleColor: '#7a1a4a' },
            { id: 'vib-7', name: 'Electric Lime',  wallpaper: 'assets/wallpapers/vibrant-23.webp', bubbleColor: '#2a5a00' },
            { id: 'vib-8', name: 'Copper Fusion',  wallpaper: 'assets/wallpapers/vibrant-24.webp', bubbleColor: '#5a2a00' }
          ]
        },
        {
          id: 'minimal',
          name: 'Minimal',
          items: [
            { id: 'min-1', name: 'Midnight Slate', wallpaper: 'color:#111b21', bubbleColor: '#3b6998' },
            { id: 'min-2', name: 'Berry Velvet',   wallpaper: 'color:#121212', bubbleColor: '#a32653' },
            { id: 'min-3', name: 'Indigo Void',    wallpaper: 'color:#0b141a', bubbleColor: '#3b3178' },
            { id: 'min-4', name: 'Plum Night',     wallpaper: 'color:#1a1225', bubbleColor: '#612c74' },
            { id: 'min-5', name: 'Warm Ash',       wallpaper: 'color:#1a1612', bubbleColor: '#6b3a1e' },
            { id: 'min-6', name: 'Steel Grey',     wallpaper: 'color:#1c1c1c', bubbleColor: '#4a4a5a' },
            { id: 'min-7', name: 'Forest Shadow',  wallpaper: 'color:#0d1a0f', bubbleColor: '#1a4d2e' },
            { id: 'min-8', name: 'Crimson Dusk',   wallpaper: 'color:#1a0a0a', bubbleColor: '#7c1a1a' }
          ]
        },
        {
          id: 'doodle',
          name: 'Doodle',
          items: [
            { id: 'doodle-1', name: 'Purple Doodle', wallpaper: 'default', bubbleColor: '#3c307a' },
            { id: 'doodle-2', name: 'Blue Doodle',   wallpaper: 'default', bubbleColor: '#043f81' },
            { id: 'doodle-3', name: 'Pink Doodle',   wallpaper: 'default', bubbleColor: '#a32652' },
            { id: 'doodle-4', name: 'Grey Doodle',   wallpaper: 'default', bubbleColor: '#4a4a5a' }
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
