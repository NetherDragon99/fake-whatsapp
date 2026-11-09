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
import { ImportModal } from './components/modal-import.js';
import { Toast } from './components/toast.js';

// Application Version Constant
window.APP_VERSION = '0.0.1';

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
    // 0. Apply Saved Theme Mode (Light / Dark)
    const savedTheme = localStorage.getItem('wa_theme_mode') || 'dark';
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#ffffff');
    }

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
      { pattern: '/settings', viewClass: SettingsView }
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

  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
          .then((registration) => {
            console.log('[SW] Registered with scope:', registration.scope);

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

        // Listen for activation messages from sw.js
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'UPDATE_ACTIVATED') {
            Toast.show('Update applied, refreshing...');
            setTimeout(() => {
              window.location.reload();
            }, 1200);
          }
        });
      });
    }
  }
}

// Bootstrap Application
const app = new Application();
window.app = app;

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
