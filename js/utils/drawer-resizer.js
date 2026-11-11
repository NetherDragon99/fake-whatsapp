// Universal Resizable Drawer / Bottom Sheet Controller
// Provides smooth, responsive dragging from top dash handle,
// maintains height on release, closes with slide-down animation below 20%,
// expands to fullscreen with back button above 80%, and integrates with router back stack.

export class DrawerResizer {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.sheet - The bottom drawer DOM element
   * @param {HTMLElement} options.handle - The drag handle / dash container element
   * @param {HTMLElement} [options.backdrop] - Optional overlay/backdrop element
   * @param {HTMLElement} [options.fullscreenHeader] - Optional header element for fullscreen mode
   * @param {string} [options.overlayId] - ID to register with router overlay stack
   * @param {number} [options.defaultHeightVh=45] - Default height as % of viewport
   * @param {number} [options.minVh=20] - Dismiss threshold % (< 20% closes window with slide-down animation)
   * @param {number} [options.maxVh=80] - Fullscreen snap threshold % (> 80% enters full screen with animation and back button)
   * @param {Function} [options.onClose] - Callback when closed
   * @param {Function} [options.onResize] - Callback during resize (heightPx, heightVh)
   * @param {Function} [options.onStateChange] - Callback when state changes (isOpen, isFullscreen)
   */
  constructor(options) {
    this.sheet = options.sheet;
    this.handle = options.handle;
    this.backdrop = options.backdrop || null;
    this.fullscreenHeader = options.fullscreenHeader || null;
    this.overlayId = options.overlayId || null;
    this.defaultHeightVh = options.defaultHeightVh || 45;
    this.minVh = options.minVh !== undefined ? options.minVh : 20;
    this.maxVh = options.maxVh !== undefined ? options.maxVh : 80;
    this.onClose = options.onClose || (() => {});
    this.onResize = options.onResize || (() => {});
    this.onStateChange = options.onStateChange || (() => {});

    this.currentHeightVh = this.defaultHeightVh;
    this.isDragging = false;
    this.isOpen = false;
    this.isFullscreen = false;
    this.startY = 0;
    this.startHeight = 0;
    this.pointerId = null;

    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundBackdropClick = this.onBackdropClick.bind(this);

    this.init();
  }

  init() {
    if (!this.sheet || !this.handle) return;

    // Enhance touch and pointer behavior on handle
    this.handle.style.touchAction = 'none';
    this.handle.style.userSelect = 'none';
    this.handle.style.webkitUserSelect = 'none';
    this.handle.classList.add('drawer-drag-handle-area');

    this.handle.addEventListener('pointerdown', this.boundPointerDown);

    if (this.backdrop) {
      this.backdrop.addEventListener('click', this.boundBackdropClick);
    }

    if (this.fullscreenHeader) {
      const backBtn = this.fullscreenHeader.querySelector('.sheet-fullscreen-back-btn') || this.fullscreenHeader.querySelector('button');
      if (backBtn) {
        backBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Tapping the back button completely closes the window with the slide-down animation
          this.close();
        });
      }

      // Allow dragging down from fullscreen header to exit fullscreen or dismiss
      this.fullscreenHeader.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button, a, input, [role="button"]')) return;
        this.boundPointerDown(e);
      });
    }
  }

  open(heightVh = null) {
    this.isOpen = true;
    const targetVh = heightVh || this.currentHeightVh || this.defaultHeightVh;
    this.sheet.classList.add('open');
    this.sheet.style.display = 'flex';
    this.sheet.style.flexDirection = 'column';

    if (this.backdrop) {
      this.backdrop.classList.remove('closing');
      this.backdrop.classList.add('active');
    }

    this.setHeightVh(targetVh, true);

    if (this.overlayId && window.router) {
      window.router.pushOverlay(this.overlayId, () => this.close(false));
    }

    this.onStateChange({ isOpen: true, isFullscreen: this.isFullscreen });
  }

  close(notifyRouter = true) {
    this.isOpen = false;
    this.isFullscreen = false;

    this.sheet.classList.remove('open');
    this.sheet.classList.remove('active');
    this.sheet.classList.remove('is-fullscreen');

    if (this.backdrop) {
      this.backdrop.classList.remove('active');
      this.backdrop.classList.add('closing');
    }

    this.sheet.style.transition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), height 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
    this.sheet.style.transform = 'translateY(100%)';

    setTimeout(() => {
      if (!this.isOpen) {
        this.sheet.style.display = 'none';
        this.sheet.style.transform = '';
        if (this.fullscreenHeader) {
          this.fullscreenHeader.style.display = 'none';
        }
        if (this.backdrop) {
          this.backdrop.classList.remove('closing');
        }
      }
    }, 280);

    if (notifyRouter && this.overlayId && window.router) {
      window.router.removeOverlay(this.overlayId);
    }

    this.onClose();
    this.onStateChange({ isOpen: false, isFullscreen: false });
  }

  setHeightVh(vh, animate = true) {
    const clampedVh = Math.max(10, Math.min(100, vh));
    this.currentHeightVh = clampedVh;
    const vhPx = (clampedVh / 100) * window.innerHeight;

    if (animate) {
      this.sheet.style.transition = 'height 0.28s cubic-bezier(0.32, 0.72, 0, 1), border-radius 0.2s ease, transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
    } else {
      this.sheet.style.transition = 'none';
    }
    this.sheet.style.transform = '';

    if (clampedVh >= this.maxVh) {
      this.isFullscreen = true;
      this.sheet.classList.add('is-fullscreen');
      this.sheet.style.height = '100vh';
      if (this.fullscreenHeader) {
        this.fullscreenHeader.style.display = 'flex';
      }
    } else {
      this.isFullscreen = false;
      this.sheet.classList.remove('is-fullscreen');
      this.sheet.style.height = `${vhPx}px`;
      if (this.fullscreenHeader) {
        this.fullscreenHeader.style.display = 'none';
      }
    }

    this.onResize(vhPx, clampedVh);
  }

  onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    this.isOpen = true;
    this.isDragging = true;
    this.pointerId = e.pointerId;
    this.startY = e.clientY;
    this.startHeight = this.sheet.getBoundingClientRect().height;

    try {
      this.handle.setPointerCapture(e.pointerId);
    } catch (err) {}

    document.body.classList.add('drawer-resizing');
    this.sheet.classList.add('is-dragging');
    this.sheet.style.transition = 'none';
    this.sheet.style.transform = '';

    window.addEventListener('pointermove', this.boundPointerMove, { passive: false });
    window.addEventListener('pointerup', this.boundPointerUp);
    window.addEventListener('pointercancel', this.boundPointerUp);
  }

  onPointerMove(e) {
    if (!this.isDragging) return;
    if (e.cancelable) e.preventDefault();

    const currentY = e.clientY;
    const deltaY = this.startY - currentY; // Drag up increases height
    const rawHeight = this.startHeight + deltaY;

    const vh = window.innerHeight;
    // Allow dragging smoothly down to 0 and up to viewport height
    const clampedHeight = Math.max(0, Math.min(vh, rawHeight));
    const currentVh = (clampedHeight / vh) * 100;

    this.sheet.style.height = `${clampedHeight}px`;

    // Dynamic visual feedback for fullscreen boundary (>= 80%)
    if (currentVh >= this.maxVh) {
      this.sheet.classList.add('is-fullscreen');
      if (this.fullscreenHeader) this.fullscreenHeader.style.display = 'flex';
    } else {
      this.sheet.classList.remove('is-fullscreen');
      if (this.fullscreenHeader) this.fullscreenHeader.style.display = 'none';
    }

    this.onResize(clampedHeight, currentVh);
  }

  onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;

    document.body.classList.remove('drawer-resizing');
    this.sheet.classList.remove('is-dragging');

    if (this.pointerId !== null) {
      try {
        this.handle.releasePointerCapture(this.pointerId);
      } catch (err) {}
      this.pointerId = null;
    }

    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('pointercancel', this.boundPointerUp);

    const vh = window.innerHeight;
    const finalHeightPx = this.sheet.getBoundingClientRect().height;
    const finalVh = (finalHeightPx / vh) * 100;

    // Restore smooth CSS transitions
    this.sheet.style.transition = 'height 0.28s cubic-bezier(0.32, 0.72, 0, 1), transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), border-radius 0.2s ease';

    // 1. If height is less than 20% of the screen: automatically close with animation of scrolling down
    if (finalVh < this.minVh) {
      this.close();
      return;
    }

    // 2. If more than 80% of the screen: automatically enter full screen with animation and back button
    if (finalVh >= this.maxVh) {
      this.setHeightVh(100, true);
      return;
    }

    // 3. Between 20% and 80%: keep the exact height where released
    this.setHeightVh(finalVh, true);
  }

  onBackdropClick(e) {
    if (e.target === this.backdrop) {
      this.close();
    }
  }

  destroy() {
    this.close(false);
    if (this.handle) {
      this.handle.removeEventListener('pointerdown', this.boundPointerDown);
    }
    if (this.backdrop) {
      this.backdrop.removeEventListener('click', this.boundBackdropClick);
    }
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('pointercancel', this.boundPointerUp);
  }
}
