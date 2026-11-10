// Hash-based Client-Side Router with Deep State Back Stack & Android Exit Guard for WhatsApp Android Clone
export class Router {
  constructor(routes, rootContainer) {
    this.routes = routes;
    this.rootContainer = rootContainer;
    this.currentViewInstance = null;
    this.historyStack = [];
    this.overlayStack = [];
    this.isExitDialogVisible = false;
    this.isInternalNavigating = false;

    window.router = this;

    window.addEventListener('hashchange', () => {
      if (!this.isInternalNavigating) {
        this.handleRoute();
      }
    });

    window.addEventListener('popstate', (e) => {
      if (this.isInternalNavigating) {
        return;
      }
      this.handleBack(true);
    });
  }

  init() {
    const currentHash = window.location.hash || '#/chats';
    this.historyStack = [currentHash];
    if (!window.location.hash) {
      this.isInternalNavigating = true;
      window.location.hash = '#/chats';
      this.handleRoute().finally(() => {
        setTimeout(() => { this.isInternalNavigating = false; }, 50);
      });
    } else {
      this.handleRoute();
    }
  }

  async navigate(hash) {
    const current = this.historyStack[this.historyStack.length - 1];
    if (current !== hash) {
      if (hash === '#/chats') {
        this.historyStack = ['#/chats'];
      } else if (hash === '#/calls' || hash === '#/settings') {
        this.historyStack = ['#/chats', hash];
      } else {
        this.historyStack.push(hash);
      }
    }

    this.isInternalNavigating = true;
    try {
      window.location.hash = hash;
      await this.handleRoute();
    } finally {
      setTimeout(() => {
        this.isInternalNavigating = false;
      }, 50);
    }
  }

  pushOverlay(id, closeFn) {
    this.overlayStack = this.overlayStack.filter(o => o.id !== id);
    this.overlayStack.push({ id, closeFn });
  }

  removeOverlay(id) {
    this.overlayStack = this.overlayStack.filter(o => o.id !== id);
  }

  back() {
    this.handleBack(false);
  }

  async handleBack(fromPopState = false) {
    // 1. Check open registered overlays / drawers / modals
    if (this.overlayStack.length > 0) {
      const topOverlay = this.overlayStack.pop();
      if (typeof topOverlay.closeFn === 'function') {
        try {
          topOverlay.closeFn();
        } catch (e) {
          console.warn('[Router] Error closing registered overlay:', e);
        }
      }
      return true;
    }

    // 2. Fallback DOM inspection for active modals/drawers
    const closedDomOverlay = this.closeActiveDomOverlay();
    if (closedDomOverlay) {
      return true;
    }

    // 3. Selection mode in HomeView
    if (this.currentViewInstance && this.currentViewInstance.isSelectionMode) {
      this.currentViewInstance.exitSelectionMode();
      return true;
    }

    // 4. Subpage / page navigation back
    if (this.historyStack.length > 1) {
      this.historyStack.pop();
      const targetHash = this.historyStack[this.historyStack.length - 1];
      this.isInternalNavigating = true;
      try {
        window.location.hash = targetHash;
        await this.handleRoute();
      } finally {
        setTimeout(() => {
          this.isInternalNavigating = false;
        }, 50);
      }
      return true;
    }

    // 5. If on bottom tab #/calls or #/settings, return to #/chats
    const currentHash = (window.location.hash || '#/chats').split('?')[0];
    if (currentHash === '#/calls' || currentHash === '#/settings') {
      this.historyStack = ['#/chats'];
      this.isInternalNavigating = true;
      try {
        window.location.hash = '#/chats';
        await this.handleRoute();
      } finally {
        setTimeout(() => {
          this.isInternalNavigating = false;
        }, 50);
      }
      return true;
    }

    // 6. At root #/chats screen: Prompt with exit dialog
    this.showExitDialog();
    return true;
  }

  closeActiveDomOverlay() {
    // Media editor modal
    const mediaEditor = document.querySelector('.media-editor-modal');
    if (mediaEditor) {
      const btnBack = mediaEditor.querySelector('#btn-editor-back');
      if (btnBack) btnBack.click();
      else mediaEditor.remove();
      return true;
    }

    // Sticker drawer
    const stickerDrawer = document.querySelector('.sticker-drawer-overlay') || document.querySelector('.wa-sticker-drawer-overlay');
    if (stickerDrawer) {
      stickerDrawer.classList.remove('active');
      setTimeout(() => stickerDrawer.remove(), 200);
      return true;
    }

    // Lightbox
    const lightbox = document.querySelector('.wa-lightbox-overlay');
    if (lightbox) {
      const closeBtn = lightbox.querySelector('.lightbox-back-btn');
      if (closeBtn) closeBtn.click();
      else lightbox.remove();
      return true;
    }

    // Custom dialog
    const customDialog = document.querySelector('.custom-dialog-overlay.active');
    if (customDialog && !this.isExitDialogVisible) {
      const cancelBtn = customDialog.querySelector('.dialog-btn-cancel');
      if (cancelBtn) cancelBtn.click();
      else customDialog.remove();
      return true;
    }

    // PIN dialog
    const pinDialog = document.querySelector('.pin-dialog-overlay');
    if (pinDialog) {
      const cancelBtn = pinDialog.querySelector('.btn-pin-cancel') || pinDialog.querySelector('.pin-key-back');
      if (cancelBtn) cancelBtn.click();
      else pinDialog.remove();
      return true;
    }

    // Image cropper
    const cropper = document.querySelector('.cropper-modal-overlay.active');
    if (cropper) {
      const closeBtn = cropper.querySelector('.cropper-close-btn');
      if (closeBtn) closeBtn.click();
      else cropper.remove();
      return true;
    }

    // Profile photo preview
    const profileModal = document.querySelector('.floating-profile-modal-overlay.active');
    if (profileModal) {
      profileModal.remove();
      return true;
    }

    // Export prompt
    const exportPrompt = document.querySelector('.wa-export-dialog-overlay.active');
    if (exportPrompt) {
      exportPrompt.remove();
      return true;
    }

    // Import sheet
    const importSheet = document.querySelector('.wa-modal-overlay');
    if (importSheet) {
      const closeBtn = importSheet.querySelector('.sheet-close-btn');
      if (closeBtn) closeBtn.click();
      else importSheet.remove();
      return true;
    }

    // Color Bottom Sheet (Theme Preview)
    const colorSheet = document.querySelector('.preview-color-bottom-sheet.open');
    if (colorSheet) {
      const backdrop = document.querySelector('.preview-color-sheet-backdrop.active');
      if (backdrop) backdrop.click();
      else {
        colorSheet.classList.remove('open');
        colorSheet.classList.remove('active');
        colorSheet.style.display = 'none';
      }
      return true;
    }

    return false;
  }

  async showExitDialog() {
    if (this.isExitDialogVisible) return;
    this.isExitDialogVisible = true;

    const { showConfirm } = await import('./components/custom-dialog.js');
    const confirmed = await showConfirm({
      title: 'Exit WhatsApp?',
      message: 'Are you sure you want to exit the app?',
      confirmText: 'Exit',
      cancelText: 'Cancel',
      isDanger: true
    });

    this.isExitDialogVisible = false;
    if (confirmed) {
      this.exitApp();
    }
  }

  exitApp() {
    try {
      window.close();
    } catch (e) {}
    
    // Display clean native exit fallback screen if window.close() is blocked by browser policy
    document.body.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0b141a; color:#e9edef; font-family:sans-serif; text-align:center; padding:24px;">
        <div style="margin-bottom:20px;">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="#25d366">
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/>
          </svg>
        </div>
        <h2 style="font-size:20px; font-weight:600; margin-bottom:8px;">WhatsApp Closed</h2>
        <p style="color:#8696a0; font-size:14px; max-width:280px; margin-bottom:24px;">You can now safely close this browser tab or window.</p>
        <button type="button" onclick="window.location.reload()" style="padding:10px 24px; border-radius:20px; border:none; background:#25d366; color:#0b141a; font-weight:600; cursor:pointer;">
          Reopen WhatsApp
        </button>
      </div>
    `;
  }

  async handleRoute() {
    const fullHash = window.location.hash.slice(1) || '/chats';
    const [pathPart, queryPart] = fullHash.split('?');

    // Parse query params
    const queryParams = {};
    if (queryPart) {
      const sp = new URLSearchParams(queryPart);
      for (const [k, v] of sp.entries()) {
        queryParams[k] = v;
      }
    }

    // Match route
    let matchedRoute = null;
    let routeParams = {};

    for (const route of this.routes) {
      const match = this.matchPattern(route.pattern, pathPart);
      if (match) {
        matchedRoute = route;
        routeParams = { ...(route.defaultParams || {}), ...match, ...queryParams };
        break;
      }
    }

    if (!matchedRoute) {
      this.navigate('#/chats');
      return;
    }

    // Cleanup previous view if needed
    if (this.currentViewInstance && typeof this.currentViewInstance.cleanup === 'function') {
      try {
        this.currentViewInstance.cleanup();
      } catch (err) {
        console.warn('[Router] Error cleaning up previous view:', err);
      }
    }

    try {
      const ViewClass = matchedRoute.viewClass;
      this.currentViewInstance = new ViewClass(this);
      await this.currentViewInstance.render(this.rootContainer, routeParams);
    } catch (renderErr) {
      console.error('[Router] Error rendering view:', renderErr);
      this.rootContainer.innerHTML = `
        <div class="empty-state" style="padding: 40px 16px; text-align: center;">
          <h3 style="color: var(--wa-text-primary); margin-bottom: 8px;">Failed to load page</h3>
          <p style="color: var(--wa-text-secondary); margin-bottom: 20px;">${renderErr.message || 'An error occurred while opening this page.'}</p>
          <button type="button" class="btn-chat-primary" onclick="window.router ? window.router.back() : (window.location.hash='#/chats')" style="padding: 10px 24px; border-radius: 20px; border: none; background: var(--app-accent, #25d366); color: #0b141a; font-weight: 600; cursor: pointer;">
            Go Back
          </button>
        </div>
      `;
    }
  }

  matchPattern(pattern, path) {
    const patternSegments = pattern.split('/').filter(Boolean);
    const pathSegments = path.split('/').filter(Boolean);

    if (patternSegments.length !== pathSegments.length) {
      return null;
    }

    const params = {};
    for (let i = 0; i < patternSegments.length; i++) {
      const pSeg = patternSegments[i];
      const actualSeg = pathSegments[i];

      if (pSeg.startsWith(':')) {
        const paramName = pSeg.slice(1);
        params[paramName] = decodeURIComponent(actualSeg);
      } else if (pSeg !== actualSeg) {
        return null;
      }
    }

    return params;
  }
}
