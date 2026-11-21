// Main Application Coordinator & Service Worker Lifecycle
import { db } from './db.js';
import { Router } from './router.js';
import { MainPagerView } from './views/main-pager-view.js';
import { HomeView } from './views/home-view.js';
import { NewListView } from './views/new-list-view.js';
import { GalleryView } from './views/gallery-view.js';
import { StarredMessagesView } from './views/starred-messages-view.js';
import { ChatView } from './views/chat-view.js';
import { ContactInfoView } from './views/contact-info-view.js';
import { CallsView } from './views/calls-view.js';
import { SettingsView } from './views/settings-view.js';
import { AppearanceView } from './views/appearance-view.js';
import { WallpaperPickerView } from './views/wallpaper-picker-view.js';
import { ThemePreviewView } from './views/theme-preview-view.js';
import { ChatThemeView } from './views/chat-theme-view.js';
import { ChatBubblePickerView } from './views/chat-bubble-picker-view.js';
import { SolidColoursPickerView } from './views/solid-colours-picker-view.js';
import { WallpaperSectionView } from './views/wallpaper-section-view.js';
import { AppIconView } from './views/app-icon-view.js';
import { ManageStorageView } from './views/manage-storage-view.js';
import { ChatStorageView } from './views/chat-storage-view.js';
import { GuideView } from './views/guide-view.js';
import { ImportModal } from './components/modal-import.js';
import { WhatsAppParser } from './parser.js';
import { finalizeParsedMessages } from './utils/message-mapper.js';
import { Toast } from './components/toast.js';
import { applyAppAccent, applyOutgoingBubbleColor } from './config/palette.js';
import { applyAppIcon } from './config/app-icons.js';
import { assetUrl } from './config/base-path.js';
import { backgroundTasks } from './utils/background-tasks.js';

// Application Version Constant
window.APP_VERSION = '2.3.9';
window.APP_CACHE_NAME = 'wa-clone-v2.3.9';

// Global deferred PWA install prompt holder
window.deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredInstallPrompt = e;
  console.log('[PWA] beforeinstallprompt captured and ready');
});

class Application {
  constructor() {
    this.router = null;
    this.importModal = null;
    this.swRegistration = null;
    this._updateCheckPromise = null;
    this._cacheStatus = null;
    this._pendingVersionReload = null;
    this.updateReady = false;
    this.pendingUpdateVersion = null;
    this.updateDownloading = false;
    this.updateProgress = { completed: 0, total: 0 };
    this._userRequestedRestart = false;
  }

  getUpdateState() {
    return {
      updateReady: this.updateReady,
      pendingUpdateVersion: this.pendingUpdateVersion,
      updateDownloading: this.updateDownloading,
      progress: this.updateProgress
    };
  }

  _emitUpdateState() {
    const detail = this.getUpdateState();
    window.dispatchEvent(new CustomEvent('wa:update-state', { detail }));
    window.dispatchEvent(new CustomEvent('app-update-state-change', { detail }));
  }

  setupViewportSync() {
    const syncViewport = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      const offsetTop = vv ? vv.offsetTop : 0;
      const rootStyle = document.documentElement.style;
      rootStyle.setProperty('--app-height', `${Math.round(height)}px`);
      rootStyle.setProperty('--app-offset-top', `${Math.round(offsetTop)}px`);

      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      if (document.documentElement.scrollTop !== 0) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body && document.body.scrollTop !== 0) {
        document.body.scrollTop = 0;
      }
    };

    syncViewport();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncViewport);
      window.visualViewport.addEventListener('scroll', syncViewport);
    }
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', () => {
      setTimeout(syncViewport, 120);
    });
    window.addEventListener('scroll', () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      syncViewport();
    }, { passive: true });
    document.addEventListener('focusin', () => {
      requestAnimationFrame(syncViewport);
      setTimeout(syncViewport, 120);
      setTimeout(syncViewport, 320);
    });
    document.addEventListener('focusout', () => {
      requestAnimationFrame(syncViewport);
      setTimeout(syncViewport, 120);
    });
  }

  async init() {
    this.setupViewportSync();

    // 0. Apply Saved Theme Mode (Light / Dark) & Accent Colors
    const savedTheme = localStorage.getItem('wa_theme_mode') || 'dark';
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#ffffff');
    }

    const savedAccent = localStorage.getItem('wa_app_accent');
    if (savedAccent) applyAppAccent(savedAccent);

    const savedBubbleColor = localStorage.getItem('wa_outgoing_bubble_color');
    if (savedBubbleColor) applyOutgoingBubbleColor(savedBubbleColor);

    // 1. Initialize IndexedDB & Persistent Disaster Recovery
    try {
      await db.init();

      // Check and auto-restore if database was wiped or is empty
      try {
        const autoRestoreResult = await db.checkAutoRestore();
        if (autoRestoreResult && autoRestoreResult.restored) {
          console.log('[AutoBackup] Auto-recovered chats from persistent backup:', autoRestoreResult);
          setTimeout(() => {
            Toast.show(`Restored ${autoRestoreResult.count} conversation(s) from persistent backup`);
          }, 400);
        }
      } catch (backupErr) {
        console.warn('[AutoBackup] Error checking auto-restore:', backupErr);
      }

      // Safe beforeunload backup flush
      window.addEventListener('beforeunload', () => {
        db.forceBackup().catch(() => {});
      });

      const dbTheme = await db.getSetting('themeMode', savedTheme);
      if (dbTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', '#ffffff');
      } else if (dbTheme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', '#0b141a');
      }

      const dbAccent = await db.getSetting('appAccentColor', null);
      if (dbAccent) applyAppAccent(dbAccent);

      const dbBubbleColor = await db.getSetting('defaultBubbleColor', null);
      if (dbBubbleColor || savedBubbleColor) {
        applyOutgoingBubbleColor(dbBubbleColor || savedBubbleColor);
      }

      const dbAppIcon = await db.getSetting('app_icon_id', localStorage.getItem('wa_app_icon_id') || 'icon-1');
      if (dbAppIcon) applyAppIcon(dbAppIcon);

      console.log('[DB] IndexedDB initialized successfully');
    } catch (err) {
      console.error('[DB] Failed to initialize database:', err);
    }

    // 2. Setup Router
    const routes = [
      { pattern: '/chats', viewClass: MainPagerView, defaultParams: { initialTab: 'chats' } },
      { pattern: '/calls', viewClass: MainPagerView, defaultParams: { initialTab: 'calls' } },
      { pattern: '/settings', viewClass: MainPagerView, defaultParams: { initialTab: 'settings' } },
      { pattern: '/new-list', viewClass: NewListView },
      { pattern: '/gallery', viewClass: GalleryView },
      { pattern: '/starred', viewClass: StarredMessagesView },
      { pattern: '/chat/:id/info', viewClass: ContactInfoView },
      { pattern: '/chat/:id', viewClass: ChatView },
      { pattern: '/manage-storage/:id', viewClass: ChatStorageView },
      { pattern: '/manage-storage', viewClass: ManageStorageView },
      { pattern: '/settings/appearance/theme', viewClass: AppearanceView, defaultParams: { subRoute: 'theme' } },
      { pattern: '/settings/appearance/app-icon', viewClass: AppIconView },
      { pattern: '/settings/appearance', viewClass: AppearanceView, defaultParams: { subRoute: '' } },
      { pattern: '/settings/guide', viewClass: GuideView },
      { pattern: '/app-icon', viewClass: AppIconView },
      { pattern: '/chat-theme', viewClass: ChatThemeView },
      { pattern: '/chat-bubble-picker', viewClass: ChatBubblePickerView },
      { pattern: '/wallpaper-picker', viewClass: WallpaperPickerView },
      { pattern: '/solid-colours-picker', viewClass: SolidColoursPickerView },
      { pattern: '/wallpaper-section', viewClass: WallpaperSectionView },
      { pattern: '/theme-preview', viewClass: ThemePreviewView }
    ];

    const appRoot = document.getElementById('app-root');
    this.router = new Router(routes, appRoot);
    this.router.init();

    // 3. Register Service Worker with relative path
    this.initServiceWorker();
  }

  showImportModal() {
    if (!this.importModal) {
      this.importModal = new ImportModal({
        onComplete: (chatId) => {
          this.router.navigate(`#/chat/${chatId}`);
        }
      });
    }
    this.importModal.show();
  }

  async loadDemoDataForChat(chatId) {
    try {
      Toast.show('Loading demo messages...');
      const resp = await fetch(assetUrl('assets/demo_whatsapp_archive.zip'));
      const blob = await resp.blob();

      const parser = new WhatsAppParser();
      const buffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(buffer);

      const unzipped = await new Promise((resolve, reject) => {
        if (!window.fflate) return reject(new Error('fflate not available'));
        window.fflate.unzip(uint8, (err, res) => (err ? reject(err) : resolve(res)));
      });

      let chatFileKey = null;
      for (const k of Object.keys(unzipped)) {
        if (k.toLowerCase().endsWith('.txt')) {
          chatFileKey = k;
          break;
        }
      }
      if (!chatFileKey) throw new Error('Chat text not found in demo');

      const chatText = new TextDecoder('utf-8').decode(unzipped[chatFileKey]);
      const parseResult = parser.parseChatLog(chatText);

      const extractedMediaFiles = new Map();
      const mediaIdMap = new Map();
      const msgTimestampMap = new Map();

      for (const m of parseResult.messages) {
        if (m.mediaName && m.timestamp) {
          const norm = parser.normalizeFilename(m.mediaName);
          if (!msgTimestampMap.has(norm)) msgTimestampMap.set(norm, m.timestamp);
        }
      }

      for (const [filename, fileData] of Object.entries(unzipped)) {
        if (filename === chatFileKey || filename.endsWith('/')) continue;
        const cleanName = parser.normalizeFilename(filename);
        const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        mediaIdMap.set(cleanName, mediaId);

        extractedMediaFiles.set(cleanName, {
          originalName: filename,
          cleanName,
          data: fileData,
          size: fileData.byteLength
        });
      }

      const existingChat = await db.getChat(chatId);
      const chatName = existingChat ? existingChat.name : 'Contact';
      let meName = parseResult.participants.find(p => /^(me|you|أنا|انا)$/i.test(p.trim()));
      if (!meName && existingChat && existingChat.name) {
        meName = parseResult.participants.find(p => p.toLowerCase() !== existingChat.name.toLowerCase());
      }
      if (!meName) {
        meName = parseResult.participants[1] || parseResult.participants[0] || 'You';
      }

      const { messages, orderedMediaIds } = finalizeParsedMessages(parseResult.messages, {
        chatId,
        meName,
        isSelfChat: false,
        mediaIdMap,
        normalizeFilename: (n) => parser.normalizeFilename(n)
      });

      const calls = parseResult.calls.map((c) => ({
        ...c,
        chatId,
        contactName: chatName
      }));

      // Instantly save messages and update chat
      await db.saveMessages(messages);

      const lastMsg = messages[messages.length - 1];
      if (existingChat) {
        await db.updateChat(chatId, {
          lastMessage: lastMsg ? {
            text: lastMsg.text,
            timestamp: lastMsg.timestamp,
            isOutgoing: lastMsg.isOutgoing,
            mediaType: lastMsg.mediaType
          } : null,
          updatedAt: Date.now()
        });
      }

      // Re-render chat immediately with placeholders/spinners so user doesn't wait!
      Toast.show('Demo messages loaded!');
      if (this.router.currentViewInstance && typeof this.router.currentViewInstance.render === 'function') {
        const appRootEl = document.getElementById('app-root');
        const layers = appRootEl.querySelectorAll(':scope > .page-layer');
        const root = layers.length ? layers[layers.length - 1] : appRootEl;
        await this.router.currentViewInstance.render(root, { id: chatId });
      }

      // Offload media decoding, thumbnails and calls to background manager
      if (extractedMediaFiles.size > 0 || calls.length > 0) {
        backgroundTasks.enqueueChatMedia({
          chatId,
          chatName,
          extractedMediaFiles,
          mediaIdMap,
          msgTimestampByMediaName: msgTimestampMap,
          orderedMediaIds,
          calls
        });
      }
    } catch (err) {
      console.error('Failed loading demo data for chat:', err);
      Toast.show('Failed loading demo: ' + err.message);
    }
  }

  _ensureUpdateOverlay() {
    let overlay = document.getElementById('wa-update-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'wa-update-overlay';
    overlay.className = 'wa-update-overlay';
    overlay.innerHTML = `
      <div class="wa-update-card" role="dialog" aria-modal="true" aria-live="polite">
        <div class="wa-update-header">
          <div class="wa-update-spinner" aria-hidden="true"></div>
          <div class="wa-update-title" id="wa-update-title">Updating WhatsApp...</div>
        </div>
        <div class="wa-update-subtitle" id="wa-update-subtitle">Clearing old cache &amp; downloading files and media...</div>
        <div class="wa-update-progress-track">
          <div class="wa-update-progress-fill" id="wa-update-progress-fill"></div>
        </div>
        <div class="wa-update-meta-row">
          <span id="wa-update-count">Checking...</span>
          <span id="wa-update-percent">0%</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  showUpdateOverlay({ title, subtitle, completed = 0, total = 0 } = {}) {
    const overlay = this._ensureUpdateOverlay();
    const titleEl = overlay.querySelector('#wa-update-title');
    const subEl = overlay.querySelector('#wa-update-subtitle');
    const fillEl = overlay.querySelector('#wa-update-progress-fill');
    const countEl = overlay.querySelector('#wa-update-count');
    const pctEl = overlay.querySelector('#wa-update-percent');

    if (title && titleEl) titleEl.textContent = title;
    if (subtitle && subEl) subEl.textContent = subtitle;

    if (total > 0) {
      const clamped = Math.max(0, Math.min(completed, total));
      const pct = Math.round((clamped / total) * 100);
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (countEl) countEl.textContent = `${clamped} / ${total} files & media`;
      if (pctEl) pctEl.textContent = `${pct}%`;
    } else {
      if (fillEl) fillEl.style.width = '12%';
      if (countEl) countEl.textContent = 'Checking server...';
      if (pctEl) pctEl.textContent = '...';
    }

    requestAnimationFrame(() => overlay.classList.add('active'));
  }

  hideUpdateOverlay() {
    const overlay = document.getElementById('wa-update-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => {
      if (!overlay.classList.contains('active') && overlay.parentNode) {
        overlay.remove();
      }
    }, 220);
  }

  _setCacheStatus(status) {
    if (!status) return;
    this._cacheStatus = status;
    window.__waCacheStatus = status;
    window.dispatchEvent(new CustomEvent('wa:cache-status', { detail: status }));
  }

  async purgeOldCachesClient(keepCacheName = window.APP_CACHE_NAME) {
    if (!('caches' in window)) return [];
    const names = await caches.keys();
    const deleted = [];
    await Promise.all(
      names.map(async (name) => {
        if (name !== keepCacheName) {
          const ok = await caches.delete(name);
          if (ok) deleted.push(name);
        }
      })
    );
    return deleted;
  }

  async sendSwMessage(payload, timeoutMs = 60000) {
    if (!('serviceWorker' in navigator)) return null;
    let target = navigator.serviceWorker.controller;
    if (!target) {
      try {
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((resolve) => setTimeout(() => resolve(null), 5000))
        ]);
        target = reg && (reg.active || reg.waiting || reg.installing);
      } catch (e) {
        return null;
      }
    }
    if (!target) return null;

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), timeoutMs);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data || null);
      };
      try {
        target.postMessage(payload, [channel.port2]);
      } catch (e) {
        clearTimeout(timer);
        resolve(null);
      }
    });
  }

  async getCacheStatus() {
    const res = await this.sendSwMessage({ type: 'GET_CACHE_STATUS' }, 8000);
    if (res && res.status) {
      this._setCacheStatus(res.status);
      return res.status;
    }
    return this._cacheStatus;
  }

  async applyPendingUpdate() {
    if (this._userRequestedRestart) return;
    this._userRequestedRestart = true;

    try {
      if (backgroundTasks && typeof backgroundTasks.hasPendingTasks === 'function' && backgroundTasks.hasPendingTasks()) {
        Toast.show('Finishing background processing before restarting...');
        await Promise.race([
          new Promise((resolve) => {
            const unsub = backgroundTasks.on('all-tasks-complete', () => {
              if (unsub) unsub();
              resolve();
            });
          }),
          new Promise((resolve) => setTimeout(resolve, 4000))
        ]);
      }
    } catch (e) { }

    Toast.show('Applying update...');

    // Force commit persistent backup before restarting to update
    try {
      await db.forceBackup();
    } catch (e) {
      console.warn('[Updater] Pre-update force backup failed:', e);
    }

    if (this.swRegistration) {
      try {
        const waiting = this.swRegistration.waiting;
        if (waiting) {
          waiting.postMessage({ type: 'SKIP_WAITING' });
          setTimeout(() => window.location.reload(), 1500);
          return;
        }
        if (this.swRegistration.installing) {
          const inst = this.swRegistration.installing;
          inst.addEventListener('statechange', () => {
            if (inst.state === 'installed') {
              inst.postMessage({ type: 'SKIP_WAITING' });
            }
          });
          setTimeout(() => window.location.reload(), 3000);
          return;
        }
      } catch (err) {
        console.warn('[Updater] Failed activating waiting SW:', err);
      }
    }

    await this.purgeOldCachesClient('__force_reload_purge__').catch(() => []);
    window.location.reload();
  }

  async checkForUpdates({ manual = false, syncMissing = true } = {}) {
    if (this._updateCheckPromise) {
      return this._updateCheckPromise;
    }

    this._updateCheckPromise = (async () => {
      this.hideUpdateOverlay();

      if (!navigator.onLine) {
        await this.getCacheStatus().catch(() => null);
        if (manual) {
          Toast.show('You are offline. Connect to internet to check for updates.');
        }
        return { offline: true };
      }

      if (this.updateReady) {
        this._emitUpdateState();
        if (manual) {
          Toast.show(`Update v${this.pendingUpdateVersion || ''} is ready — tap "Restart to Update"`);
        }
        return { updateReady: true, targetVersion: this.pendingUpdateVersion };
      }

      if (manual) {
        Toast.show('Checking for updates in background...');
      }

      let remoteMeta = null;
      try {
        const resp = await fetch(`./version.json?t=${Date.now()}`, {
          cache: 'no-store'
        });
        if (resp && resp.ok) {
          remoteMeta = await resp.json();
        }
      } catch (err) {
        console.warn('[Updater] version.json check skipped:', err);
      }

      const hasNewVersion = Boolean(
        remoteMeta &&
        remoteMeta.version &&
        remoteMeta.version !== window.APP_VERSION
      );

      if (hasNewVersion) {
        console.log(`[Updater] New version ${remoteMeta.version} detected (current ${window.APP_VERSION}) — downloading silently in background`);
        this._pendingVersionReload = remoteMeta.version;
        this.pendingUpdateVersion = remoteMeta.version;

        try {
          if (this.swRegistration) {
            await this.swRegistration.update();
            if (this.swRegistration.waiting) {
              this.updateDownloading = false;
              this.updateReady = true;
              this._emitUpdateState();
              if (manual) {
                Toast.show(`Update v${remoteMeta.version} ready — tap "Restart to Update"`);
              }
              return { updateReady: true, targetVersion: remoteMeta.version };
            }
            if (this.swRegistration.installing) {
              this.updateDownloading = true;
              this._emitUpdateState();
              return { updating: true, targetVersion: remoteMeta.version };
            }
          }
        } catch (err) {
          console.warn('[Updater] Service Worker update failed:', err);
        }

        // Fallback when SW didn't report waiting/installing yet: mark update ready so user can restart cleanly from Settings
        this.updateDownloading = false;
        this.updateReady = true;
        this._emitUpdateState();
        if (manual) {
          Toast.show(`Update v${remoteMeta.version} available — tap "Restart to Update"`);
        }
        return { updateReady: true, targetVersion: remoteMeta.version };
      }

      // Same code version: check if a waiting SW already finished downloading
      if (this.swRegistration) {
        try {
          await this.swRegistration.update();
        } catch (e) { }
        if (this.swRegistration.waiting) {
          this.updateDownloading = false;
          this.updateReady = true;
          this._emitUpdateState();
          return { updateReady: true };
        }
      }

      // Only purge obsolete caches when NO update is pending or downloading
      if (!this.updateReady && !this.updateDownloading && !this.swRegistration?.waiting && !this.swRegistration?.installing) {
        await this.purgeOldCachesClient(window.APP_CACHE_NAME).catch(() => []);
      }

      const status = await this.getCacheStatus();
      if (syncMissing && (!status || !status.complete)) {
        const synced = await this.sendSwMessage({
          type: 'SYNC_CACHE',
          forceRefresh: false,
          reason: manual ? 'manual-sync' : 'launch-sync'
        }, 120000);

        if (synced && synced.status) {
          this._setCacheStatus(synced.status);
        }
        if (manual && synced && synced.status) {
          Toast.show(`Synced ${synced.status.cached}/${synced.status.total} offline files & media`);
        }
        return { synced: true, status: synced && synced.status };
      }

      if (manual) {
        const countText = status ? ` — ${status.cached}/${status.total} files cached` : '';
        Toast.show(`You are up to date (v${window.APP_VERSION}${countText})`);
      }
      return { upToDate: true, status };
    })();

    try {
      return await this._updateCheckPromise;
    } finally {
      this._updateCheckPromise = null;
    }
  }

  initServiceWorker() {
    this.hideUpdateOverlay();

    if ('serviceWorker' in navigator) {
      const hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;

      const triggerUserRestartReload = () => {
        if (refreshing || !this._userRequestedRestart) return;
        refreshing = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (this._userRequestedRestart) {
          triggerUserRestartReload();
        }
      });

      // Listen for silent background download progress & update readiness messages from sw.js
      navigator.serviceWorker.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'PRECACHE_PROGRESS') {
          if (msg.status) this._setCacheStatus(msg.status);
          this.updateProgress = {
            completed: msg.completed || 0,
            total: msg.total || 0
          };
          const isVersionUpdate = Boolean(this._pendingVersionReload || (msg.reason === 'install' && hadController));
          if (isVersionUpdate) {
            this.updateDownloading = !msg.done;
            if (msg.version) this.pendingUpdateVersion = msg.version;
            if (msg.done && hadController) {
              this.updateReady = true;
            }
          } else {
            this.updateDownloading = false;
          }
          this._emitUpdateState();
          return;
        }

        if (msg.type === 'UPDATE_READY') {
          this.updateDownloading = false;
          this.updateReady = true;
          this.pendingUpdateVersion = msg.version || this.pendingUpdateVersion;
          this._emitUpdateState();
          return;
        }

        if (msg.type === 'CACHE_STATUS' && msg.status) {
          this._setCacheStatus(msg.status);
          return;
        }

        if (msg.type === 'UPDATE_ACTIVATED') {
          if (msg.status) this._setCacheStatus(msg.status);
          this.updateDownloading = false;
          if (this._userRequestedRestart) {
            triggerUserRestartReload();
          } else {
            this.updateReady = false;
            this._emitUpdateState();
          }
        }
      });

      const registerSW = () => {
        navigator.serviceWorker.register('./sw.js', {
          scope: './',
          updateViaCache: 'none'
        })
          .then((registration) => {
            this.swRegistration = registration;
            console.log('[SW] Registered with updateViaCache:none, scope:', registration.scope);

            // If an update finished installing earlier and is waiting, expose "Restart to Update" immediately
            if (registration.waiting && hadController) {
              this.updateDownloading = false;
              this.updateReady = true;
              this._emitUpdateState();
            }

            // Silently check remote version & ensure offline assets in background without blocking UI
            this.checkForUpdates({ manual: false, syncMissing: true }).catch(() => { });

            // Check for new version when device reconnects to internet
            window.addEventListener('online', () => {
              console.log('[SW] Reconnected to internet, checking for updates silently...');
              this.checkForUpdates({ manual: false, syncMissing: true }).catch(() => { });
            });

            // Check for updates silently when app tab becomes active again
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible' && navigator.onLine) {
                this.checkForUpdates({ manual: false, syncMissing: false }).catch(() => { });
              }
            });

            // Periodic background check every 30 minutes while online
            setInterval(() => {
              if (navigator.onLine) {
                this.checkForUpdates({ manual: false, syncMissing: false }).catch(() => { });
              }
            }, 30 * 60 * 1000);

            // Detect Service Worker updates silently in the background
            registration.addEventListener('updatefound', () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                if (hadController) {
                  this.updateDownloading = true;
                  this._emitUpdateState();
                }
                installingWorker.addEventListener('statechange', () => {
                  if (installingWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                      console.log('[SW] New version downloaded and waiting silently — exposing Restart button in Settings');
                      this.updateDownloading = false;
                      this.updateReady = true;
                      this._emitUpdateState();
                    }
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn('[SW] Registration failed (expected on file:// or unsupported setups):', err);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }
  }
}

// Bootstrap Application
const app = new Application();
window.app = app;

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
