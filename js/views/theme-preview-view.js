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
    this.dimming = 35; // 0 to 75
    this.savedDimming = 35;
    this.isDimmingEnabled = true;
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
        const loadedDim = chat.wallpaperDimming;
        this.dimming = loadedDim !== undefined ? loadedDim : 35;
        this.bubbleColor = params.bubbleColor || chat.outgoingBubbleColor || (await db.getSetting('defaultBubbleColor', '#1d3c4e'));
      }
    } else {
      if (!params.wallpaper && !params.id) {
        this.currentId = await db.getSetting('defaultWallpaper', 'default');
      }
      const loadedDim = await db.getSetting('defaultDimming', 35);
      this.dimming = loadedDim !== undefined ? loadedDim : 35;
      this.bubbleColor = params.bubbleColor || (await db.getSetting('defaultBubbleColor', '#1d3c4e'));
    }

    this.savedDimming = this.dimming > 0 ? this.dimming : 35;
    this.isDimmingEnabled = this.dimming > 0;

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
          <div class="preview-header-title">Preview</div>
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
              <div class="preview-meta">11:09 pm</div>
            </div>
          </div>

          <div class="preview-msg-row outgoing">
            <div class="preview-bubble preview-bubble-outgoing" id="preview-outgoing-bubble" dir="auto">
              <div class="preview-text">This will replace your existing default chat theme. Only you see your chat themes.</div>
              <div class="preview-meta">
                <span>11:09 pm</span>
                ${Icons.checks(true, 'preview-receipt', 15)}
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Controls Bar (Aligned & Spaced authentically) -->
        <div class="preview-bottom-bar">
          <!-- Bubble Color Picker Trigger Button (Left) -->
          <button type="button" class="preview-bubble-color-btn" id="btn-open-palette" aria-label="Change bubble color" title="Change bubble color">
            <span class="preview-color-circle" id="preview-current-color-dot" style="background-color: ${this.bubbleColor};"></span>
          </button>

          <!-- Pagination Dots Capsule (Center) -->
          <div class="preview-pagination-capsule" id="preview-dots-wrap">
            ${this.renderPaginationDots()}
          </div>

          <!-- Vertical Dimming Slider & Sun/Moon Toggle (Right) -->
          <div class="preview-right-controls" id="preview-right-controls">
            <!-- Vertical Slider Capsule -->
            <div class="dimmer-slider-capsule ${this.isDimmingEnabled ? '' : 'hidden'}" id="preview-dimmer-capsule" role="slider" aria-label="Wallpaper brightness slider" aria-valuemin="0" aria-valuemax="75" aria-valuenow="${this.dimming}">
              <div class="dimmer-slider-track"></div>
              <div class="dimmer-slider-thumb" id="preview-dimmer-thumb">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3.5"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              </div>
            </div>

            <!-- Sun / Moon Toggle Button -->
            <button type="button" class="btn-toggle-dim-mode" id="btn-toggle-dim-mode" aria-label="Toggle wallpaper dimming">
              ${this.renderDimToggleIcon()}
            </button>
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

  renderDimToggleIcon() {
    if (this.isDimmingEnabled) {
      // Sun icon with rays
      return `
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#111b21" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      `;
    } else {
      // Crescent Moon icon
      return `
        <svg viewBox="0 0 24 24" width="22" height="22" fill="#111b21" stroke="none">
          <path d="M12.3 2a10 10 0 0 0-.19 1.4 10 10 0 0 0 10 10c.48 0 .95-.04 1.4-.11a10 10 0 1 1-11.21-11.29z"/>
        </svg>
      `;
    }
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

  updateDimmerThumb() {
    const thumb = this.container ? this.container.querySelector('#preview-dimmer-thumb') : null;
    const capsule = this.container ? this.container.querySelector('#preview-dimmer-capsule') : null;
    if (!thumb || !capsule) return;
    const ratio = Math.max(0, Math.min(1, this.dimming / 75));
    // Travel range is 92px, top padding is 6px
    const topPx = ratio * 92 + 6;
    thumb.style.top = `${topPx}px`;
    capsule.setAttribute('aria-valuenow', this.dimming);
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
    this.updateDimmerThumb();

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

    // Vertical Dimming Slider Capsule Dragging
    const capsule = this.container.querySelector('#preview-dimmer-capsule');
    if (capsule) {
      let isDraggingDimmer = false;
      const handlePointerDrag = (e) => {
        const rect = capsule.getBoundingClientRect();
        // Travel range is 92px (140 - 36 - 12), thumb center offset is 18px + 6px top padding
        const rawY = e.clientY - rect.top - 18 - 6;
        const clampedY = Math.max(0, Math.min(92, rawY));
        const ratio = clampedY / 92;
        this.dimming = Math.round(ratio * 75);
        this.savedDimming = this.dimming;
        this.updateDisplay();
      };

      capsule.addEventListener('pointerdown', (e) => {
        isDraggingDimmer = true;
        try { capsule.setPointerCapture(e.pointerId); } catch (err) {}
        handlePointerDrag(e);
      });

      capsule.addEventListener('pointermove', (e) => {
        if (!isDraggingDimmer) return;
        handlePointerDrag(e);
      });

      const onPointerEnd = (e) => {
        if (!isDraggingDimmer) return;
        isDraggingDimmer = false;
        try { capsule.releasePointerCapture(e.pointerId); } catch (err) {}
      };

      capsule.addEventListener('pointerup', onPointerEnd);
      capsule.addEventListener('pointercancel', onPointerEnd);
    }

    // Sun / Moon Dimming Mode Toggle Button
    const toggleBtn = this.container.querySelector('#btn-toggle-dim-mode');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (this.isDimmingEnabled) {
          // Dimming enabled -> Switch to Moon: remove dimming, hide slider
          this.isDimmingEnabled = false;
          this.savedDimming = this.dimming || 35;
          this.dimming = 0;
          if (capsule) capsule.classList.add('hidden');
        } else {
          // Dimming disabled -> Switch to Sun: restore dimming, show slider
          this.isDimmingEnabled = true;
          this.dimming = this.savedDimming || 35;
          if (capsule) capsule.classList.remove('hidden');
        }
        toggleBtn.innerHTML = this.renderDimToggleIcon();
        this.updateDisplay();
      });
    }

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
