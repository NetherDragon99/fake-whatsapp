// Hash-based Client-Side Hierarchical Router with Strict Parent Navigation & Android Exit Guard for WhatsApp Android Clone
import { backgroundTasks } from './utils/background-tasks.js';

export class Router {
  constructor(routes, rootContainer) {
    this.routes = routes;
    this.rootContainer = rootContainer;
    this.currentViewInstance = null;
    this.currentHash = window.location.hash || '#/chats';
    this.historyStack = this.getAncestorChain(this.currentHash);
    this.overlayStack = [];
    this.isExitDialogVisible = false;
    this.isInternalNavigating = false;
    this._routeToken = 0;
    this._navDirection = null;

    window.router = this;

    window.addEventListener('hashchange', () => {
      if (!this.isInternalNavigating) {
        const newHash = window.location.hash || '#/chats';
        if (newHash !== this.currentHash) {
          const oldChain = this.historyStack;
          const newChain = this.getAncestorChain(newHash);
          const dir = newChain.length < oldChain.length ? 'back' : 'forward';
          this.currentHash = newHash;
          this.historyStack = newChain;
          this.saveHistoryStack();
          this.handleRoute(dir);
        }
      }
    });

    window.addEventListener('popstate', (e) => {
      if (this.isInternalNavigating) {
        return;
      }
      this.handlePopState(e);
    });
  }

  /**
   * Deterministically returns the logical parent route for any given route hash.
   * Enforces strict WhatsApp Android hierarchy:
   * - '#/chats': null (root)
   * - '#/calls', '#/settings': '#/chats'
   * - '#/chat/:id': '#/chats'
   * - '#/chat/:id/info': '#/chat/:id'
   * - Sub-screens with ?chatId=...: return to the chat info screen '#/chat/:id/info'
   * - Settings sub-screens: return to '#/settings' or their direct section parent
   */
  getParentRoute(rawHash) {
    if (!rawHash) return null;
    const cleanWithLeading = rawHash.startsWith('#') ? rawHash : ('#' + rawHash);
    const [pathPart, queryPart] = cleanWithLeading.split('?');
    const query = new URLSearchParams(queryPart || '');
    const chatId = query.get('chatId');

    // 1. Root Screen: '#/chats' has no parent (triggers exit confirmation)
    if (pathPart === '#/chats' || pathPart === '#/' || pathPart === '#' || pathPart === '') {
      return null;
    }

    // 2. Main tabs: '#/calls' and '#/settings' return to '#/chats'
    if (pathPart === '#/calls' || pathPart === '#/settings') {
      return '#/chats';
    }

    // 3. Contact Info: '#/chat/:id/info' returns to '#/chat/:id'
    const contactInfoMatch = pathPart.match(/^#\/chat\/([^\/]+)\/info$/);
    if (contactInfoMatch) {
      const cId = contactInfoMatch[1];
      return `#/chat/${cId}`;
    }

    // 4. Chat Screen: '#/chat/:id' ALWAYS returns to '#/chats'
    const chatMatch = pathPart.match(/^#\/chat\/([^\/]+)$/);
    if (chatMatch) {
      return '#/chats';
    }

    // 5. Storage Hierarchy:
    // '#/manage-storage/:id' returns to '#/manage-storage'
    if (pathPart.match(/^#\/manage-storage\/[^\/]+$/)) {
      return '#/manage-storage';
    }
    // '#/manage-storage' returns to '#/settings'
    if (pathPart === '#/manage-storage') {
      return '#/settings';
    }

    // 6. Settings Sub-pages:
    // '#/settings/appearance/theme' and '#/settings/appearance/app-icon' return to '#/settings/appearance'
    if (pathPart === '#/settings/appearance/theme' || pathPart === '#/settings/appearance/app-icon') {
      return '#/settings/appearance';
    }
    // '#/app-icon' returns to '#/settings/appearance'
    if (pathPart === '#/app-icon') {
      return '#/settings/appearance';
    }
    // '#/settings/appearance' returns to '#/settings'
    if (pathPart === '#/settings/appearance') {
      return '#/settings';
    }

    // 7. Theme & Wallpaper Hierarchy:
    // Theme Preview:
    if (pathPart === '#/theme-preview') {
      const wp = query.get('wallpaper') || '';
      if (wp.startsWith('color:')) {
        return `#/solid-colours-picker${chatId ? `?chatId=${encodeURIComponent(chatId)}` : ''}`;
      }
      const cat = query.get('category');
      if (cat) {
        return `#/wallpaper-section?category=${encodeURIComponent(cat)}${chatId ? `&chatId=${encodeURIComponent(chatId)}` : ''}`;
      }
      if (chatId) {
        return `#/wallpaper-picker?chatId=${encodeURIComponent(chatId)}`;
      }
      return '#/chat-theme';
    }

    // Solid Colours Picker:
    if (pathPart === '#/solid-colours-picker') {
      return `#/wallpaper-picker${chatId ? `?chatId=${encodeURIComponent(chatId)}` : ''}`;
    }

    // Wallpaper Section:
    if (pathPart === '#/wallpaper-section') {
      return `#/wallpaper-picker${chatId ? `?chatId=${encodeURIComponent(chatId)}` : ''}`;
    }

    // Wallpaper Picker:
    if (pathPart === '#/wallpaper-picker') {
      if (chatId) {
        return `#/chat/${encodeURIComponent(chatId)}/info`;
      }
      return '#/chat-theme';
    }

    // Chat Bubble Picker:
    if (pathPart === '#/chat-bubble-picker') {
      if (chatId) {
        return `#/chat-theme?chatId=${encodeURIComponent(chatId)}`;
      }
      return '#/chat-theme';
    }

    // Chat Theme View:
    if (pathPart === '#/chat-theme') {
      if (chatId) {
        return `#/chat/${encodeURIComponent(chatId)}`;
      }
      return '#/settings/appearance';
    }

    // 8. Shared Screens: Gallery, Starred, New-List:
    // Gallery:
    if (pathPart === '#/gallery') {
      if (chatId) {
        return `#/chat/${encodeURIComponent(chatId)}/info`;
      }
      return '#/chats';
    }

    // Starred Messages:
    if (pathPart === '#/starred') {
      if (chatId) {
        return `#/chat/${encodeURIComponent(chatId)}/info`;
      }
      return '#/chats';
    }

    // New List:
    if (pathPart === '#/new-list') {
      if (chatId) {
        return `#/chat/${encodeURIComponent(chatId)}/info`;
      }
      return '#/chats';
    }

    // Default fallback:
    return '#/chats';
  }

  /**
   * Generates a strict array of ancestor routes from '#/chats' up to target hash.
   * Guarantees no stale or disconnected routes can ever exist in historyStack.
   */
  getAncestorChain(hash) {
    if (!hash || hash === '#/chats' || hash === '#/' || hash === '#' || hash === '') {
      return ['#/chats'];
    }
    const chain = [hash];
    let curr = hash;
    const visited = new Set([hash]);
    while (curr) {
      const parent = this.getParentRoute(curr);
      if (!parent || parent === curr || visited.has(parent)) {
        break;
      }
      chain.unshift(parent);
      visited.add(parent);
      curr = parent;
    }
    if (chain[0] !== '#/chats') {
      chain.unshift('#/chats');
    }
    return chain;
  }

  saveHistoryStack() {
    try {
      sessionStorage.setItem('wa_history_stack', JSON.stringify(this.historyStack));
    } catch (e) {}
  }

  loadHistoryStack() {
    try {
      const raw = sessionStorage.getItem('wa_history_stack');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(item => typeof item === 'string' && item.startsWith('#/'));
        }
      }
    } catch (e) {}
    return null;
  }

  setupRootGuard() {
    try {
      const currentHash = (window.location.hash || '#/chats').split('?')[0];
      if (currentHash === '#/chats' || currentHash === '#/' || currentHash === '#' || currentHash === '') {
        if (!window.history.state || window.history.state.guard !== 'active') {
          window.history.replaceState({ guard: 'root', hash: '#/chats' }, '');
          window.history.pushState({ guard: 'active', hash: '#/chats' }, '');
        }
      }
    } catch (e) {}
  }

  init() {
    const rawHash = window.location.hash;
    const currentHash = rawHash || '#/chats';
    this.currentHash = currentHash;
    this.historyStack = this.getAncestorChain(currentHash);
    this.saveHistoryStack();
    this.setupRootGuard();

    if (!rawHash) {
      this.isInternalNavigating = true;
      window.location.hash = '#/chats';
      this.handleRoute().finally(() => {
        setTimeout(() => { this.isInternalNavigating = false; }, 50);
      });
    } else {
      this.handleRoute();
    }
  }

  async navigate(hash, options = {}) {
    if (!hash) return;
    const previousHash = this.currentHash || window.location.hash || '#/chats';
    if (previousHash === hash) return;

    const currentChain = this.getAncestorChain(previousHash);
    const targetChain = this.getAncestorChain(hash);
    const direction = options.direction || (targetChain.length < currentChain.length ? 'back' : 'forward');

    this._navDirection = direction;
    this.historyStack = targetChain;
    this.saveHistoryStack();
    this.currentHash = hash;

    this.isInternalNavigating = true;
    try {
      if (options.replace) {
        window.history.replaceState({ guard: 'active', hash }, '', hash);
      } else {
        window.history.pushState({ guard: 'active', hash }, '', hash);
      }
      await this.handleRoute(direction);
    } finally {
      setTimeout(() => {
        this.isInternalNavigating = false;
        this._navDirection = null;
      }, 60);
    }
  }

  syncTab(hash) {
    if (!hash) return;
    const cleanHash = hash.split('?')[0];
    const previous = (this.currentHash || window.location.hash || '#/chats').split('?')[0];
    if (previous === cleanHash) return;

    this.historyStack = this.getAncestorChain(cleanHash);
    this.saveHistoryStack();
    this.currentHash = cleanHash;

    this.isInternalNavigating = true;
    try {
      window.history.replaceState({ guard: 'active', hash: cleanHash }, '', cleanHash);
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

  hasActiveDomOverlay() {
    return Boolean(
      document.querySelector('.media-editor-modal') ||
      document.querySelector('.sticker-drawer-overlay.active, .wa-sticker-drawer-overlay.active, .wa-sticker-drawer-overlay') ||
      document.querySelector('.wa-lightbox-overlay') ||
      document.querySelector('.stacked-album-overlay') ||
      (document.querySelector('.custom-dialog-overlay.active') && !this.isExitDialogVisible) ||
      document.querySelector('.pin-dialog-overlay') ||
      document.querySelector('.cropper-modal-overlay.active') ||
      document.querySelector('.floating-profile-modal-overlay.active') ||
      document.querySelector('.wa-export-dialog-overlay.active') ||
      document.querySelector('.wa-modal-overlay') ||
      document.querySelector('.preview-color-bottom-sheet.open') ||
      (this.currentViewInstance && (this.currentViewInstance.isSelectionMode || this.currentViewInstance.homeView?.isSelectionMode))
    );
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

    // Lightbox & Stacked Album
    const lightbox = document.querySelector('.wa-lightbox-overlay') || document.querySelector('.stacked-album-overlay');
    if (lightbox) {
      const closeBtn = lightbox.querySelector('.lightbox-back-btn');
      if (closeBtn) closeBtn.click();
      else lightbox.remove();
      return true;
    }

    // Custom dialog (not the exit dialog)
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
      const fsBackBtn = importSheet.querySelector('.sheet-fullscreen-back-btn');
      const closeBtn = importSheet.querySelector('.sheet-close-btn');
      if (fsBackBtn && importSheet.querySelector('.is-fullscreen')) {
        fsBackBtn.click();
      } else if (closeBtn) {
        closeBtn.click();
      } else {
        importSheet.remove();
      }
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

  handlePopState(e) {
    if (this.isInternalNavigating) return;

    // 1. If an overlay / modal / drawer is open, dismiss it and stay on the current view
    if (this.overlayStack.length > 0 || this.hasActiveDomOverlay()) {
      window.history.pushState({ guard: 'active', hash: this.currentHash }, '', this.currentHash);
      this.handleBack(true);
      return;
    }

    // 2. If exit dialog is already showing, cancel it
    if (this.isExitDialogVisible) {
      const exitDialog = document.querySelector('.custom-dialog-overlay.active');
      if (exitDialog) {
        const cancelBtn = exitDialog.querySelector('.dialog-btn-cancel');
        if (cancelBtn) cancelBtn.click();
        else exitDialog.remove();
      }
      this.isExitDialogVisible = false;
      this.setupRootGuard();
      return;
    }

    const fromHash = this.currentHash || window.location.hash || '#/chats';
    const cleanFromHash = fromHash.split('?')[0];

    // 3. User pressed back at the root '#/chats' screen -> Prompt exit dialog
    if (cleanFromHash === '#/chats' || cleanFromHash === '#/' || cleanFromHash === '#' || cleanFromHash === '') {
      this.setupRootGuard();
      this.showExitDialog();
      return;
    }

    // 4. In all other screens: calculate exact hierarchical parent!
    const targetParent = this.getParentRoute(fromHash);
    if (!targetParent || targetParent === fromHash) {
      this.setupRootGuard();
      this.showExitDialog();
      return;
    }

    // 5. Navigate to parent cleanly with back animation
    this._navDirection = 'back';
    this.historyStack = this.getAncestorChain(targetParent);
    this.saveHistoryStack();
    this.currentHash = targetParent;

    this.isInternalNavigating = true;
    try {
      window.history.replaceState({ guard: 'active', hash: targetParent }, '', targetParent);
      this.handleRoute('back');
    } finally {
      setTimeout(() => {
        this.isInternalNavigating = false;
        this._navDirection = null;
      }, 60);
    }
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
    if (this.currentViewInstance && (this.currentViewInstance.isSelectionMode || this.currentViewInstance.homeView?.isSelectionMode)) {
      if (typeof this.currentViewInstance.exitSelectionMode === 'function') {
        this.currentViewInstance.exitSelectionMode();
      } else if (this.currentViewInstance.homeView?.exitSelectionMode) {
        this.currentViewInstance.homeView.exitSelectionMode();
      }
      return true;
    }

    const current = this.currentHash || window.location.hash || '#/chats';
    const cleanCurrent = current.split('?')[0];

    // 4. Root check: If already at '#/chats', show exit dialog
    if (cleanCurrent === '#/chats' || cleanCurrent === '#/' || cleanCurrent === '#' || cleanCurrent === '') {
      this.showExitDialog();
      return true;
    }

    // 5. Hierarchical Parent resolution
    const targetParent = this.getParentRoute(current);
    if (!targetParent || targetParent === current) {
      this.showExitDialog();
      return true;
    }

    // 6. Navigate to parent with back animation
    this._navDirection = 'back';
    this.historyStack = this.getAncestorChain(targetParent);
    this.saveHistoryStack();
    this.currentHash = targetParent;

    this.isInternalNavigating = true;
    try {
      window.history.replaceState({ guard: 'active', hash: targetParent }, '', targetParent);
      await this.handleRoute('back');
    } finally {
      setTimeout(() => {
        this.isInternalNavigating = false;
        this._navDirection = null;
      }, 60);
    }
    return true;
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
    } else {
      this.setupRootGuard();
    }
  }

  exitApp() {
    // 1. Cordova/Capacitor/PhoneGap/Android WebAPK support if available
    try {
      if (window.navigator && window.navigator.app && typeof window.navigator.app.exitApp === 'function') {
        window.navigator.app.exitApp();
        return;
      }
    } catch (e) {}

    // 2. Direct window.close()
    try {
      window.close();
    } catch (e) {}

    // 3. Self-window script-opened trick
    try {
      window.open('', '_self', '');
      window.close();
    } catch (e) {}

    // 4. In browsers where window.close() is blocked:
    // Do NOT render any "WhatsApp Closed - You can now safely close this browser tab" screen.
    // Cleanly navigate history back or replace with about:blank and blank the viewport.
    setTimeout(() => {
      try {
        if (window.history.length > 1) {
          window.history.back();
        }
      } catch (e) {}

      try {
        window.location.replace('about:blank');
      } catch (e) {
        document.documentElement.innerHTML = '';
        document.body.style.background = '#000000';
      }
    }, 100);
  }

  async handleRoute(forcedDirection = null) {
    const rawHash = window.location.hash || '#/chats';
    this.currentHash = rawHash;
    const fullHash = rawHash.slice(1) || '/chats';
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

    // Update active chat priority for background task manager
    if (routeParams && routeParams.id && (matchedRoute.pattern.startsWith('/chat') || matchedRoute.pattern.includes('chat'))) {
      backgroundTasks.setActiveChat(routeParams.id);
    } else {
      backgroundTasks.setActiveChat(null);
    }

    // Re-arm root guard if entering '#/chats'
    if (pathPart === '/chats' || pathPart === 'chats') {
      this.setupRootGuard();
    }

    // If the main pager is already mounted and the target route is also one of the main tabs,
    // smoothly switch the pager tab without destroying/recreating the DOM!
    if (this.currentViewInstance && this.currentViewInstance.isMainPager && (matchedRoute.pattern === '/chats' || matchedRoute.pattern === '/calls' || matchedRoute.pattern === '/settings')) {
      const targetTab = routeParams.initialTab || (pathPart.includes('calls') ? 'calls' : (pathPart.includes('settings') ? 'settings' : 'chats'));
      this.currentViewInstance.switchToTab(targetTab);
      this._lastStackLen = this.historyStack.length;
      this._lastTopHash = this.historyStack[this.historyStack.length - 1] || '';
      return;
    }

    // Snap any in-flight transition to its end state before starting a new one
    this.finalizeLayers();
    const token = ++this._routeToken;

    // Work out slide direction
    const stackLen = this.historyStack.length;
    const topHash = this.historyStack[stackLen - 1] || '';
    let direction = forcedDirection || this._navDirection;
    if (!direction || direction === 'none') {
      if (this._lastStackLen !== undefined) {
        if (stackLen > this._lastStackLen) direction = 'forward';
        else if (stackLen < this._lastStackLen) direction = 'back';
        else if (topHash !== this._lastTopHash) direction = 'forward';
        else direction = 'none';
      } else {
        direction = 'none';
      }
    }
    this._lastStackLen = stackLen;
    this._lastTopHash = topHash;

    const oldLayer = this.rootContainer.querySelector(':scope > .page-layer');

    // Cleanup previous view if needed
    if (this.currentViewInstance && typeof this.currentViewInstance.cleanup === 'function') {
      try {
        this.currentViewInstance.cleanup();
      } catch (err) {
        console.warn('[Router] Error cleaning up previous view:', err);
      }
    }

    // Every page renders into its own layer so it can slide in/out
    const newLayer = document.createElement('div');
    newLayer.className = 'page-layer';
    const animate = !!oldLayer && direction !== 'none' && !this.prefersReducedMotion();
    if (animate) {
      if (direction === 'forward') {
        newLayer.classList.add('page-layer-top');
        newLayer.style.transform = 'translateX(100%)';
      } else {
        newLayer.classList.add('page-layer-under');
        newLayer.style.transform = 'translateX(-24%)';
        oldLayer.classList.add('page-layer-front');
      }
      oldLayer.classList.add('is-transitioning');
    }
    this.rootContainer.appendChild(newLayer);

    let transitionStarted = false;
    const startTransition = () => {
      if (transitionStarted) return;
      transitionStarted = true;
      if (token !== this._routeToken) return;
      if (!animate) {
        newLayer.style.transform = '';
        if (oldLayer && oldLayer.parentNode) oldLayer.remove();
        if (oldLayer) {
          newLayer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
        }
        return;
      }
      this.runPageTransition(direction, oldLayer, newLayer, token);
    };
    const fallbackTimer = animate ? setTimeout(startTransition, 160) : null;

    try {
      const ViewClass = matchedRoute.viewClass;
      this.currentViewInstance = new ViewClass(this);
      await this.currentViewInstance.render(newLayer, routeParams);
    } catch (renderErr) {
      console.error('[Router] Error rendering view:', renderErr);
      newLayer.innerHTML = `
        <div class="empty-state" style="padding: 40px 16px; text-align: center;">
          <h3 style="color: var(--wa-text-primary); margin-bottom: 8px;">Failed to load page</h3>
          <p style="color: var(--wa-text-secondary); margin-bottom: 20px;">${renderErr.message || 'An error occurred while opening this page.'}</p>
          <button type="button" class="btn-chat-primary" onclick="window.router ? window.router.back() : (window.location.hash='#/chats')" style="padding: 10px 24px; border-radius: 20px; border: none; background: var(--app-accent, #25d366); color: #0b141a; font-weight: 600; cursor: pointer;">
            Go Back
          </button>
        </div>
      `;
    }

    if (fallbackTimer) clearTimeout(fallbackTimer);
    if (token !== this._routeToken) {
      // A newer navigation superseded this one
      if (newLayer.parentNode && this.rootContainer.querySelectorAll(':scope > .page-layer').length > 1) {
        newLayer.remove();
      }
      return;
    }
    startTransition();
  }

  prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  finalizeLayers() {
    const layers = Array.from(this.rootContainer.querySelectorAll(':scope > .page-layer'));
    if (layers.length === 0) return;
    const keep = layers[layers.length - 1];
    for (const layer of layers) {
      layer.getAnimations().forEach((a) => a.cancel());
      if (layer !== keep) layer.remove();
    }
    keep.className = 'page-layer';
    keep.style.transform = '';
    keep.style.filter = '';
  }

  runPageTransition(direction, oldLayer, newLayer, token) {
    const duration = 340;
    const easing = 'cubic-bezier(0.22, 0.85, 0.25, 1)';
    const finish = () => {
      if (token !== this._routeToken) return;
      if (oldLayer && oldLayer.parentNode) oldLayer.remove();
      newLayer.className = 'page-layer';
      newLayer.style.transform = '';
      newLayer.style.filter = '';
    };

    let enter;
    if (direction === 'forward') {
      // New page slides in from the right; old page drifts left and dims
      newLayer.style.transform = '';
      enter = newLayer.animate(
        [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }],
        { duration, easing, fill: 'both' }
      );
      oldLayer.animate(
        [
          { transform: 'translateX(0)', filter: 'brightness(1)' },
          { transform: 'translateX(-24%)', filter: 'brightness(0.55)' }
        ],
        { duration, easing, fill: 'both' }
      );
    } else {
      // Old page slides away to the right; the page below returns from the left
      newLayer.style.transform = '';
      newLayer.animate(
        [
          { transform: 'translateX(-24%)', filter: 'brightness(0.55)' },
          { transform: 'translateX(0)', filter: 'brightness(1)' }
        ],
        { duration, easing, fill: 'both' }
      );
      enter = oldLayer.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }],
        { duration, easing, fill: 'both' }
      );
    }
    enter.onfinish = finish;
    enter.oncancel = () => {};
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
