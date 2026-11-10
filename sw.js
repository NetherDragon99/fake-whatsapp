// WhatsApp Android Clone Service Worker v0.0.17
const CACHE_NAME = 'wa-clone-v0.0.17';

const STICKER_FILES = [
  './assets/stickers/sticker-1.svg',
  './assets/stickers/sticker-2.svg',
  './assets/stickers/sticker-3.svg',
  './assets/stickers/sticker-4.svg',
  './assets/stickers/sticker-5.svg',
  './assets/stickers/sticker-6.svg',
  './assets/stickers/sticker-7.svg',
  './assets/stickers/sticker-8.svg',
  './assets/stickers/sticker-9.svg',
  './assets/stickers/sticker-10.svg',
  './assets/stickers/sticker-11.svg',
  './assets/stickers/sticker-12.svg'
];

const APP_ICON_FILES = [
  './assets/icons/app-icon-1.png',
  './assets/icons/app-icon-2.png',
  './assets/icons/app-icon-3.png',
  './assets/icons/app-icon-4.png',
  './assets/icons/app-icon-5.png',
  './assets/icons/app-icon-6.png',
  './assets/icons/app-icon-7.png',
  './assets/icons/app-icon-8.png',
  './assets/icons/app-icon-9.png',
  './assets/icons/app-icon-10.png',
  './assets/icons/app-icon-11.png',
  './assets/icons/app-icon-12.png',
  './assets/icons/app-icon-13.png',
  './assets/icons/app-icon-14.png',
  './assets/icons/app-icon-15.png'
];

const WALLPAPER_FILES = [
  './assets/wallpapers/nature-1.webp',
  './assets/wallpapers/nature-2.webp',
  './assets/wallpapers/nature-3.webp',
  './assets/wallpapers/nature-4.webp',
  './assets/wallpapers/nature-5.webp',
  './assets/wallpapers/nature-6.webp',
  './assets/wallpapers/nature-7.webp',
  './assets/wallpapers/nature-8.webp',
  './assets/wallpapers/nature-9.webp',
  './assets/wallpapers/nature-10.webp',
  './assets/wallpapers/nature-11.webp',
  './assets/wallpapers/nature-12.webp',
  './assets/wallpapers/vibrant-1.webp',
  './assets/wallpapers/vibrant-2.webp',
  './assets/wallpapers/vibrant-3.webp',
  './assets/wallpapers/vibrant-4.webp',
  './assets/wallpapers/vibrant-5.webp',
  './assets/wallpapers/vibrant-6.webp',
  './assets/wallpapers/vibrant-7.webp',
  './assets/wallpapers/vibrant-8.webp',
  './assets/wallpapers/vibrant-9.webp',
  './assets/wallpapers/vibrant-10.webp',
  './assets/wallpapers/vibrant-11.webp',
  './assets/wallpapers/vibrant-12.webp',
  './assets/wallpapers/vibrant-13.webp',
  './assets/wallpapers/vibrant-14.webp'
];

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/main.css',
  './css/chat.css',
  './css/components.css',
  './vendor/fflate.min.js',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
  './js/app.js',
  './js/db.js',
  './js/router.js',
  './js/parser.js',
  './js/audio-player.js',
  './js/virtual-scroller.js',
  './js/icons.js',
  './js/config/base-path.js',
  './js/config/palette.js',
  './js/config/wallpapers.js',
  './js/config/app-icons.js',
  './js/components/custom-dialog.js',
  './js/components/image-cropper.js',
  './js/components/modal-import.js',
  './js/components/pin-dialog.js',
  './js/components/lightbox.js',
  './js/components/toast.js',
  './js/components/voice-recorder.js',
  './js/components/media-editor-modal.js',
  './js/components/sticker-drawer.js',
  './js/views/home-view.js',
  './js/views/new-list-view.js',
  './js/views/gallery-view.js',
  './js/views/chat-view.js',
  './js/views/contact-info-view.js',
  './js/views/calls-view.js',
  './js/views/settings-view.js',
  './js/views/appearance-view.js',
  './js/views/app-icon-view.js',
  './js/views/wallpaper-picker-view.js',
  './js/views/theme-preview-view.js',
  './js/views/chat-theme-view.js',
  './js/views/chat-bubble-picker-view.js',
  './js/views/solid-colours-picker-view.js',
  './js/views/wallpaper-section-view.js',
  './assets/data/chat-themes.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/icon.svg',
  './assets/demo_whatsapp_archive.zip',
  ...WALLPAPER_FILES,
  ...APP_ICON_FILES,
  ...STICKER_FILES
];

// Install: Resilient pre-caching using Promise.allSettled
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Precache partial item skipped:', url, err);
          })
        )
      );
    })
  );
});

// Activate: Purge obsolete UI caches, NEVER touch IndexedDB
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(async () => {
      await self.clients.claim();
      // Notify active tabs about new version activation
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({ type: 'UPDATE_ACTIVATED', version: CACHE_NAME });
      }
    })
  );
});

// Fetch: Cache-first for wallpapers & icons, Stale-While-Revalidate for app code
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignore cross-origin non-GET or chrome-extension schemes
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle SPA navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html') || caches.match('./'))
    );
    return;
  }

  // Cache-first for wallpapers, static icons, and archives
  const isStaticMedia = url.pathname.includes('/assets/wallpapers/') ||
                        url.pathname.includes('/assets/icons/') ||
                        url.pathname.includes('.zip');

  if (isStaticMedia) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Stale-While-Revalidate for application code and stylesheets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Offline fallback
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
