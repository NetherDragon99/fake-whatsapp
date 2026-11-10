// Main Application Coordinator & Service Worker Lifecycle
import { db } from './db.js';
import { Router } from './router.js';
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
import { ImportModal } from './components/modal-import.js';
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
      { pattern: '/chats', viewClass: HomeView },
      { pattern: '/new-list', viewClass: NewListView },
      { pattern: '/gallery', viewClass: GalleryView },
      { pattern: '/chat/:id/info', viewClass: ContactInfoView },
      { pattern: '/chat/:id', viewClass: ChatView },
      { pattern: '/calls', viewClass: CallsView },
      { pattern: '/settings', viewClass: SettingsView },
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

    // 3. Setup Swipe Navigation Between Main Tabs (Chats <-> Calls <-> Settings)
    this.initSwipeNavigation(appRoot);

    // 4. Register Service Worker with relative path
    this.initServiceWorker();
  }

  initSwipeNavigation(appRoot) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isSwiping = false;

    const mainTabs = ['#/chats', '#/calls', '#/settings'];

    appRoot.addEventListener('touchstart', (e) => {
      // Ignore gesture if inside horizontal scroll containers or modals
      if (
        e.target.closest('#filter-chips-bar') ||
        e.target.closest('.info-media-chips') ||
        e.target.closest('.gallery-type-chips') ||
        e.target.closest('.album-slider-scroller') ||
        e.target.closest('.modal-overlay') ||
        e.target.closest('.wa-lightbox-overlay') ||
        e.target.closest('.stacked-album-overlay')
      ) {
        isSwiping = false;
        return;
      }

      const hash = window.location.hash || '#/chats';
      const isMainTab = mainTabs.some((tab) => hash.startsWith(tab));
      if (!isMainTab) {
        isSwiping = false;
        return;
      }

      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      currentX = startX;
      currentY = startY;
      isSwiping = true;
    }, { passive: true });

    appRoot.addEventListener('touchmove', (e) => {
      if (!isSwiping || !e.touches || !e.touches[0]) return;
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
    }, { passive: true });

    appRoot.addEventListener('touchend', () => {
      if (!isSwiping) return;
      isSwiping = false;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      // Ensure predominant horizontal swipe with distance threshold
      if (Math.abs(deltaX) > 65 && Math.abs(deltaX) > 1.7 * Math.abs(deltaY)) {
        const hash = window.location.hash || '#/chats';
        if (deltaX < 0) {
          // Swipe Left -> next tab
          if (hash.startsWith('#/chats')) {
            this.router.navigate('#/calls');
          } else if (hash.startsWith('#/calls')) {
            this.router.navigate('#/settings');
          }
        } else {
          // Swipe Right -> previous tab
          if (hash.startsWith('#/settings')) {
            this.router.navigate('#/calls');
          } else if (hash.startsWith('#/calls')) {
            this.router.navigate('#/chats');
          }
        }
      }
    }, { passive: true });
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
              registration.update().catch(() => {});
            }

            // Check for new version when device reconnects to internet
            window.addEventListener('online', () => {
              console.log('[SW] Reconnected to internet, checking for updates...');
              registration.update().catch(() => {});
            });

            // Check for updates when app tab becomes active again
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible' && navigator.onLine) {
                registration.update().catch(() => {});
              }
            });

            // Periodic background check every 30 minutes while online
            setInterval(() => {
              if (navigator.onLine) {
                registration.update().catch(() => {});
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
