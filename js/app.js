// Main Application Coordinator & Service Worker Lifecycle
import { db } from './db.js';
import { Router } from './router.js';
import { MainPagerView } from './views/main-pager-view.js';
import { HomeView } from './views/home-view.js';
import { NewListView } from './views/new-list-view.js';
import { GalleryView } from './views/gallery-view.js';
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
import { ImportModal } from './components/modal-import.js';
import { WhatsAppParser } from './parser.js';
import { Toast } from './components/toast.js';
import { applyAppAccent, applyOutgoingBubbleColor } from './config/palette.js';
import { applyAppIcon } from './config/app-icons.js';
import { assetUrl } from './config/base-path.js';

// Application Version Constant
window.APP_VERSION = '1.0.0';

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
  }

  async init() {
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

    // 1. Initialize IndexedDB
    try {
      await db.init();
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
      if (dbBubbleColor) applyOutgoingBubbleColor(dbBubbleColor);

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
      { pattern: '/chat/:id/info', viewClass: ContactInfoView },
      { pattern: '/chat/:id', viewClass: ChatView },
      { pattern: '/manage-storage/:id', viewClass: ChatStorageView },
      { pattern: '/manage-storage', viewClass: ManageStorageView },
      { pattern: '/settings/appearance/theme', viewClass: AppearanceView, defaultParams: { subRoute: 'theme' } },
      { pattern: '/settings/appearance/app-icon', viewClass: AppIconView },
      { pattern: '/settings/appearance', viewClass: AppearanceView, defaultParams: { subRoute: '' } },
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

      const mediaBatch = [];
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

        const type = parser.categorizeMedia(cleanName);
        let mimeType = 'application/octet-stream';
        if (type === 'sticker') mimeType = 'image/webp';
        else if (type === 'image') mimeType = 'image/jpeg';
        else if (type === 'video') mimeType = 'video/mp4';
        else if (type === 'pdf') mimeType = 'application/pdf';
        else if (type === 'audio') mimeType = 'audio/ogg';

        mediaBatch.push({
          id: mediaId,
          chatId,
          filename: cleanName,
          type,
          mimeType,
          blob: new Blob([fileData], { type: mimeType }),
          thumbnailBlob: null,
          size: fileData.byteLength,
          duration: 0,
          pageCount: 0,
          timestamp: msgTimestampMap.get(cleanName) || Date.now()
        });
      }

      const existingChat = await db.getChat(chatId);
      const chatName = existingChat ? existingChat.name : 'Contact';
      const meName = parseResult.participants[0] || 'You';

      const messages = parseResult.messages.map((m) => {
        let cleanMediaName = null;
        let linkedMediaId = null;
        if (m.mediaName) {
          cleanMediaName = parser.normalizeFilename(m.mediaName);
          if (mediaIdMap.has(cleanMediaName)) linkedMediaId = mediaIdMap.get(cleanMediaName);
        }
        return {
          ...m,
          chatId,
          isOutgoing: m.sender === meName,
          mediaId: linkedMediaId,
          isVoiceNote: m.mediaType === 'audio',
          duration: m.duration || 0
        };
      });

      const calls = parseResult.calls.map((c) => ({
        ...c,
        chatId,
        contactName: chatName
      }));

      await db.saveMediaBatch(mediaBatch);
      await db.saveMessages(messages);
      await db.saveCallsBatch(calls);

      const lastMsg = messages[messages.length - 1];
      if (existingChat) {
        await db.updateChat(chatId, {
          lastMessage: lastMsg ? {
            text: lastMsg.text,
            timestamp: lastMsg.timestamp,
            isOutgoing: lastMsg.isOutgoing,
            mediaType: lastMsg.mediaType
          } : null,
          updatedAt: lastMsg ? lastMsg.timestamp : Date.now()
        });
      }

      Toast.show('Demo data loaded successfully!');
      if (this.router.currentViewInstance && typeof this.router.currentViewInstance.render === 'function') {
        const root = document.getElementById('app-root');
        await this.router.currentViewInstance.render(root, { id: chatId });
      }
    } catch (err) {
      console.error('Failed loading demo data for chat:', err);
      Toast.show('Failed loading demo: ' + err.message);
    }
  }

  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      // Seamless SW Auto-Update: Only reload if an existing controller was replaced
      const hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) return;
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      // Listen for activation messages from sw.js
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_ACTIVATED') {
          if (!hadController) return;
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        }
      });

      const registerSW = () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
          .then((registration) => {
            console.log('[SW] Registered with scope:', registration.scope);

            // Silent background update check when online
            if (navigator.onLine) {
              registration.update().catch(() => { });
            }

            // Check for new version when device reconnects to internet
            window.addEventListener('online', () => {
              console.log('[SW] Reconnected to internet, checking for updates...');
              registration.update().catch(() => { });
            });

            // Check for updates when app tab becomes active again
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible' && navigator.onLine) {
                registration.update().catch(() => { });
              }
            });

            // Periodic background check every 30 minutes while online
            setInterval(() => {
              if (navigator.onLine) {
                registration.update().catch(() => { });
              }
            }, 30 * 60 * 1000);

            // Detect Service Worker updates
            registration.addEventListener('updatefound', () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.addEventListener('statechange', () => {
                  if (installingWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                      console.log('[SW] New version available, activating...');
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
