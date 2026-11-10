// Screen: Interactive Fullscreen Theme Preview (Stage 2 of Wallpaper & Theme setup)
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { WALLPAPER_PRESETS, getWallpaperPreset } from '../config/wallpapers.js';
import { APP_COLOR_PALETTE, applyOutgoingBubbleColor } from '../config/palette.js';
import { assetUrl } from '../config/base-path.js';
import { Toast } from '../components/toast.js';
import { DrawerResizer } from '../utils/drawer-resizer.js';

export class ThemePreviewView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.scope = 'global';
    this.chatId = null;
    this.currentId = 'default';
    this.dimming = 0; // 0 to 100
    this.bubbleColor = '#1d3c4e'; // default slate-blue
    this.presets = WALLPAPER_PRESETS;
    this.currentIndex = 0;
    this.customBlob = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    this.scope = params.scope || 'global';
    this.chatId = params.chatId || null;
    this.currentId = params.wallpaper || params.id || 'default';

    // Retrieve initial values
    if (this.chatId) {
      const chat = await db.getChat(this.chatId);
      if (chat) {
        if (!params.wallpaper && !params.id && chat.wallpaper) this.currentId = chat.wallpaper;
        this.dimming = chat.wallpaperDimming || 0;
        this.bubbleColor = params.bubbleColor || chat.outgoingBubbleColor || (await db.getSetting('defaultBubbleColor', '#1d3c4e'));
      }
    } else {
      if (!params.wallpaper && !params.id) {
        this.currentId = await db.getSetting('defaultWallpaper', 'default');
      }
      this.dimming = await db.getSetting('defaultDimming', 0);
      this.bubbleColor = params.bubbleColor || (await db.getSetting('defaultBubbleColor', '#1d3c4e'));
    }

    if (this.currentId === 'custom') {
      this.customBlob = await db.getSetting('temp_preview_wallpaper', null);
    }

    // Determine starting index in presets if preset id
    const foundIdx = this.presets.findIndex((p) => p.id === this.currentId);
    this.currentIndex = foundIdx !== -1 ? foundIdx : 0;

    rootEl.innerHTML = `
      <div class="screen-view theme-preview-screen" id="preview-screen-root">
        <!-- Wallpaper Background Layer -->
        <div class="preview-wallpaper-layer" id="preview-wp-bg"></div>
        <div class="preview-dimming-layer" id="preview-dim-overlay"></div>

        <!-- Top App Bar -->
        <header class="theme-preview-header">
          <button type="button" class="preview-header-btn" id="btn-preview-back" aria-label="Cancel">
            ${Icons.arrowBack('', 24)}
          </button>
          <div class="preview-header-title">Chat bubble</div>
          <button type="button" class="preview-header-apply" id="btn-preview-apply" aria-label="Apply wallpaper">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </button>
        </header>

        <!-- Mock Chat Messages Area (Swipe Target) -->
        <div class="preview-chat-body" id="preview-chat-body">
          <div class="preview-date-pill">Today</div>

          <div class="preview-msg-row incoming">
            <div class="preview-bubble preview-bubble-incoming" dir="auto">
              <div class="preview-text">Swipe left or right to preview more wallpapers 🏞️✨</div>
              <div class="preview-meta">8:24 am</div>
            </div>
          </div>

          <div class="preview-msg-row outgoing">
            <div class="preview-bubble preview-bubble-outgoing" id="preview-outgoing-bubble" dir="auto">
              <div class="preview-text">This will replace your existing default chat theme. Only you see your chat themes.</div>
              <div class="preview-meta">
                <span>8:24 am</span>
                ${Icons.checks(true, 'preview-receipt', 15)}
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Controls Bar -->
        <div class="preview-bottom-bar">
          <!-- Bubble Color Picker Trigger Button (Left) -->
          <button type="button" class="preview-bubble-color-btn" id="btn-open-palette" aria-label="Change bubble color" title="Change bubble color">
            <span class="preview-color-circle" id="preview-current-color-dot" style="background-color: ${this.bubbleColor};"></span>
          </button>

          <!-- Pagination Dots (Center) -->
          <div class="preview-pagination-dots" id="preview-dots-wrap">
            ${this.renderPaginationDots()}
          </div>

          <!-- Vertical Dimming Slider Pill (Right) -->
          <div class="preview-dimmer-wrap">
            <div class="dimmer-slider-pill">
              <input type="range" id="preview-dimmer-slider" min="0" max="75" value="${this.dimming}" orient="vertical" aria-label="Wallpaper brightness" />
              <div class="dimmer-icon-box">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Backdrop for Color Bottom Sheet -->
        <div class="preview-color-sheet-backdrop" id="preview-color-backdrop"></div>

        <!-- Bubble Color Bottom Sheet (Draggable, Resizable & Collapsible) -->
        <div class="preview-color-bottom-sheet" id="preview-color-sheet">
          <div class="bottom-sheet-handle-bar" id="preview-color-handle-bar">
            <div class="sheet-drag-handle"></div>
          </div>
          <!-- Fullscreen Header (active when dragged > 90%) -->
          <div class="sheet-fullscreen-header" id="preview-color-fullscreen-header" style="display:none;">
            <button type="button" class="sheet-fullscreen-back-btn" id="btn-color-fullscreen-back" aria-label="Exit fullscreen">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
            </button>
            <div class="sheet-fullscreen-title">Chat bubble color</div>
          </div>
          <!-- Scrollable Swatches -->
          <div class="sheet-content-scroll">
            <div class="sheet-swatch-grid">
              ${APP_COLOR_PALETTE.map((hex) => `
                <button type="button" class="sheet-colour-swatch ${hex.toLowerCase() === this.bubbleColor.toLowerCase() ? 'active' : ''}" data-color="${hex}" style="background-color: ${hex};" aria-label="Color ${hex}">
                  ${hex.toLowerCase() === this.bubbleColor.toLowerCase() ? `
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  ` : ''}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updateDisplay();
  }

  renderPaginationDots() {
    const total = Math.min(8, this.presets.length);
    const activeDot = this.currentIndex % total;
    let dots = '';
    for (let i = 0; i < total; i++) {
      dots += `<span class="preview-dot ${i === activeDot ? 'active' : ''}"></span>`;
    }
    return dots;
  }

  updateDisplay() {
    const wpLayer = this.container.querySelector('#preview-wp-bg');
    const dimLayer = this.container.querySelector('#preview-dim-overlay');
    const outgoingBubble = this.container.querySelector('#preview-outgoing-bubble');
    const colorDot = this.container.querySelector('#preview-current-color-dot');
    const dotsWrap = this.container.querySelector('#preview-dots-wrap');

    // 1. Update Dimming
    if (dimLayer) {
      dimLayer.style.backgroundColor = `rgba(0, 0, 0, ${this.dimming / 100})`;
    }

    // 2. Update Bubble Color
    if (outgoingBubble) {
      outgoingBubble.style.backgroundColor = this.bubbleColor;
    }
    if (colorDot) {
      colorDot.style.backgroundColor = this.bubbleColor;
    }

    // 3. Update Wallpaper Background
    if (this.currentId.startsWith('color:')) {
      const col = this.currentId.replace('color:', '');
      wpLayer.style.backgroundImage = 'none';
      wpLayer.style.backgroundColor = col;
    } else if (this.currentId === 'custom' && this.customBlob) {
      const url = URL.createObjectURL(this.customBlob);
      wpLayer.style.backgroundImage = `url(${url})`;
      wpLayer.style.backgroundColor = 'transparent';
    } else if (this.currentId.startsWith('assets/')) {
      wpLayer.style.backgroundImage = `url(${assetUrl(this.currentId)})`;
      wpLayer.style.backgroundColor = 'transparent';
    } else {
      const preset = this.presets.find((p) => p.id === this.currentId || p.file === this.currentId) || this.presets[this.currentIndex];
      if (preset && preset.file) {
        const fullUrl = assetUrl(preset.file);
        wpLayer.style.backgroundImage = `url(${fullUrl})`;
        wpLayer.style.backgroundColor = 'transparent';
      } else {
        // Default clean dark background
        wpLayer.style.backgroundImage = 'none';
        wpLayer.style.backgroundColor = '#0b141a';
      }
    }

    // 4. Update Dots
    if (dotsWrap) {
      dotsWrap.innerHTML = this.renderPaginationDots();
    }
  }

  bindEvents() {
    // Back button
    this.container.querySelector('#btn-preview-back').addEventListener('click', () => {
      this.router.back();
    });

    // Dimming slider
    const dimmerSlider = this.container.querySelector('#preview-dimmer-slider');
    dimmerSlider.addEventListener('input', (e) => {
      this.dimming = parseInt(e.target.value, 10);
      this.updateDisplay();
    });

    // Initialize Universal Resizable Drawer for Bubble Color Bottom Sheet
    const colorSheet = this.container.querySelector('#preview-color-sheet');
    const colorHandle = this.container.querySelector('#preview-color-handle-bar');
    const colorBackdrop = this.container.querySelector('#preview-color-backdrop');
    const fullscreenHeader = this.container.querySelector('#preview-color-fullscreen-header');

    this.colorDrawerResizer = new DrawerResizer({
      sheet: colorSheet,
      handle: colorHandle,
      backdrop: colorBackdrop,
      fullscreenHeader: fullscreenHeader,
      overlayId: 'preview-color-sheet',
      defaultHeightVh: 48,
      minVh: 20,
      maxVh: 90
    });

    // Color picker sheet toggle button
    const colorBtn = this.container.querySelector('#btn-open-palette');
    colorBtn.addEventListener('click', () => {
      if (this.colorDrawerResizer.isOpen) {
        this.colorDrawerResizer.close();
      } else {
        this.colorDrawerResizer.open();
      }
    });

    // Close sheet when tapping outside on chat body
    this.container.querySelector('#preview-chat-body').addEventListener('click', () => {
      if (this.colorDrawerResizer.isOpen) {
        this.colorDrawerResizer.close();
      }
    });

    // Color swatch clicks in sheet
    this.container.querySelectorAll('.sheet-colour-swatch').forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const hex = swatch.dataset.color;
        this.bubbleColor = hex;

        // Update active checkmark in swatches
        this.container.querySelectorAll('.sheet-colour-swatch').forEach((s) => {
          s.classList.remove('active');
          s.innerHTML = '';
        });
        swatch.classList.add('active');
        swatch.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        `;

        this.updateDisplay();
      });
    });

    // Swipe left/right gesture to switch wallpapers
    const chatBody = this.container.querySelector('#preview-chat-body');
    chatBody.addEventListener('touchstart', (e) => {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    chatBody.addEventListener('touchend', (e) => {
      const deltaX = e.changedTouches[0].clientX - this.touchStartX;
      const deltaY = e.changedTouches[0].clientY - this.touchStartY;

      // Ensure horizontal swipe
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          // Swipe left -> Next preset
          this.currentIndex = (this.currentIndex + 1) % this.presets.length;
          this.currentId = this.presets[this.currentIndex].id;
        } else {
          // Swipe right -> Prev preset
          this.currentIndex = (this.currentIndex - 1 + this.presets.length) % this.presets.length;
          this.currentId = this.presets[this.currentIndex].id;
        }
        this.updateDisplay();
      }
    }, { passive: true });

    // Apply button
    const applyBtn = this.container.querySelector('#btn-preview-apply');
    applyBtn.addEventListener('click', async () => {
      await this.saveTheme();
    });
  }

  async saveTheme() {
    let savedWallpaperValue = this.currentId;

    if (this.currentId === 'custom' && this.customBlob) {
      savedWallpaperValue = this.customBlob;
    }

    if (this.chatId) {
      // Per-chat configuration
      await db.updateChat(this.chatId, {
        wallpaper: savedWallpaperValue,
        wallpaperDimming: this.dimming,
        outgoingBubbleColor: this.bubbleColor
      });
    } else {
      // Global configuration
      await db.setSetting('defaultWallpaper', savedWallpaperValue);
      await db.setSetting('defaultDimming', this.dimming);
      await db.setSetting('defaultBubbleColor', this.bubbleColor);
      applyOutgoingBubbleColor(this.bubbleColor);
    }

    // Update Recent list in IndexedDB
    const recent = await db.getSetting('recent_wallpapers', []);
    const filtered = recent.filter((r) => r !== this.currentId);
    filtered.unshift(this.currentId);
    const updatedRecent = filtered.slice(0, 8);
    await db.setSetting('recent_wallpapers', updatedRecent);

    Toast.show('Theme applied');

    // Return to chat or chat-theme
    if (this.chatId) {
      this.router.navigate(`#/chat/${this.chatId}`);
    } else {
      this.router.navigate('#/chat-theme');
    }
  }
}
