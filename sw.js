// WhatsApp Android Clone Service Worker
const CACHE_NAME = 'wa-clone-v0.0.1';

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
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon.svg',
  './assets/demo_whatsapp_archive.zip'
];

// Install: Cache essential core UI assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial error (assets will be cached on first request):', err);
      });
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

// Fetch: Stale-While-Revalidate for local assets, cache-first for vendor/icons
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
