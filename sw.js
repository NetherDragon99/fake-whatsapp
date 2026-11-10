// WhatsApp Android Clone Service Worker v0.0.6
const CACHE_NAME = 'wa-clone-v0.0.6';

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
  './js/components/custom-dialog.js',
  './js/components/image-cropper.js',
  './js/components/modal-import.js',
  './js/components/pin-dialog.js',
  './js/components/lightbox.js',
  './js/components/toast.js',
  './js/views/home-view.js',
  './js/views/new-list-view.js',
  './js/views/gallery-view.js',
  './js/views/chat-view.js',
  './js/views/contact-info-view.js',
  './js/views/calls-view.js',
  './js/views/settings-view.js',
  './js/views/appearance-view.js',
  './js/views/wallpaper-picker-view.js',
  './js/views/theme-preview-view.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon.svg',
  './assets/demo_whatsapp_archive.zip',
  ...WALLPAPER_FILES
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
