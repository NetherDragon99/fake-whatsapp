// WhatsApp Android Clone Service Worker v2.3.1
const APP_VERSION = '2.3.1';
const CACHE_NAME = 'wa-clone-v2.3.1';

const APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/main.css',
  './css/chat.css',
  './css/components.css',
  './css/motion.css',
  './css/starred.css',
  './js/app.js',
  './js/audio-player.js',
  './js/db.js',
  './js/icons.js',
  './js/parser.js',
  './js/router.js',
  './js/ui-motion.js',
  './js/virtual-scroller.js',
  './js/utils/drawer-resizer.js',
  './js/config/app-icons.js',
  './js/config/base-path.js',
  './js/config/palette.js',
  './js/config/wallpapers.js',
  './js/components/chat-exporter.js',
  './js/components/custom-dialog.js',
  './js/components/emoji-picker-sheet.js',
  './js/components/forward-picker.js',
  './js/components/image-cropper.js',
  './js/components/lightbox.js',
  './js/components/media-editor-modal.js',
  './js/components/message-info-sheet.js',
  './js/components/modal-import.js',
  './js/components/pin-dialog.js',
  './js/components/pin-duration-picker.js',
  './js/components/pinned-panel.js',
  './js/components/reaction-bar.js',
  './js/components/share-options-modal.js',
  './js/components/sticker-drawer.js',
  './js/components/toast.js',
  './js/components/voice-recorder.js',
  './js/views/app-icon-view.js',
  './js/views/appearance-view.js',
  './js/views/calls-view.js',
  './js/views/chat-bubble-picker-view.js',
  './js/views/chat-storage-view.js',
  './js/views/chat-theme-view.js',
  './js/views/chat-view.js',
  './js/views/contact-info-view.js',
  './js/views/gallery-view.js',
  './js/views/home-view.js',
  './js/views/main-pager-view.js',
  './js/views/manage-storage-view.js',
  './js/views/new-list-view.js',
  './js/views/settings-view.js',
  './js/views/solid-colours-picker-view.js',
  './js/views/starred-messages-view.js',
  './js/views/theme-preview-view.js',
  './js/views/wallpaper-picker-view.js',
  './js/views/wallpaper-section-view.js',
  './vendor/fflate.min.js',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
  './assets/data/chat-themes.json',
  './assets/demo_whatsapp_archive.zip'
];

const MAIN_ICON_FILES = [
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

const APP_ICON_SVG_FILES = Array.from({ length: 15 }, (_, i) => `./assets/icons/app-icon-${i + 1}.svg`);
const APP_ICON_PNG_FILES = Array.from({ length: 15 }, (_, i) => `./assets/icons/app-icon-${i + 1}.png`);
const STICKER_FILES = Array.from({ length: 12 }, (_, i) => `./assets/stickers/sticker-${i + 1}.svg`);
const NATURE_WALLPAPERS = Array.from({ length: 36 }, (_, i) => `./assets/wallpapers/nature-${i + 1}.webp`);
const VIBRANT_WALLPAPERS = Array.from({ length: 26 }, (_, i) => `./assets/wallpapers/vibrant-${i + 1}.webp`);

const PRECACHE_ASSETS = [
  ...APP_SHELL_FILES,
  ...MAIN_ICON_FILES,
  ...APP_ICON_SVG_FILES,
  ...APP_ICON_PNG_FILES,
  ...STICKER_FILES,
  ...NATURE_WALLPAPERS,
  ...VIBRANT_WALLPAPERS
];

let activeSyncPromise = null;

async function broadcastToClients(payload) {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage(payload);
    }
  } catch (e) {
    // Ignore broadcast failures
  }
}

async function purgeOutdatedCaches() {
  const cacheNames = await caches.keys();
  const deleted = [];
  await Promise.all(
    cacheNames.map(async (name) => {
      if (name !== CACHE_NAME) {
        console.log('[SW] Purging outdated cache:', name);
        const ok = await caches.delete(name);
        if (ok) deleted.push(name);
      }
    })
  );
  return deleted;
}

async function fetchFreshAndStore(cache, url) {
  const req = new Request(url, { cache: 'reload' });
  const response = await fetch(req);
  if (!response || !response.ok) {
    throw new Error(`HTTP ${response ? response.status : 'error'} for ${url}`);
  }
  await cache.put(url, response);
}

async function downloadAssetsWithProgress(cache, urls, { initialCompleted = 0, total = urls.length, reason = 'install' } = {}) {
  if (urls.length === 0) {
    return { completed: initialCompleted, total, failedUrls: [] };
  }

  let completed = initialCompleted;
  const failedFirstPass = [];
  const CONCURRENCY = 8;
  let index = 0;

  await broadcastToClients({
    type: 'PRECACHE_PROGRESS',
    completed,
    total,
    version: APP_VERSION,
    cacheName: CACHE_NAME,
    reason
  });

  async function runWorker() {
    while (index < urls.length) {
      const currentIdx = index++;
      const url = urls[currentIdx];
      try {
        await fetchFreshAndStore(cache, url);
        completed++;
        if (completed % 4 === 0 || completed === total) {
          await broadcastToClients({
            type: 'PRECACHE_PROGRESS',
            completed,
            total,
            version: APP_VERSION,
            cacheName: CACHE_NAME,
            reason
          });
        }
      } catch (err) {
        failedFirstPass.push(url);
      }
    }
  }

  const workerCount = Math.min(CONCURRENCY, urls.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  // Retry failed URLs once cleanly
  const failedUrls = [];
  for (const url of failedFirstPass) {
    try {
      await fetchFreshAndStore(cache, url);
      completed++;
      await broadcastToClients({
        type: 'PRECACHE_PROGRESS',
        completed,
        total,
        version: APP_VERSION,
        cacheName: CACHE_NAME,
        reason
      });
    } catch (err) {
      console.warn('[SW] Failed to cache asset after retry:', url, err);
      failedUrls.push(url);
    }
  }

  await broadcastToClients({
    type: 'PRECACHE_PROGRESS',
    completed,
    total,
    failed: failedUrls.length,
    done: true,
    version: APP_VERSION,
    cacheName: CACHE_NAME,
    reason
  });

  return { completed, total, failedUrls };
}

async function inspectCacheStatus() {
  const cache = await caches.open(CACHE_NAME);
  const missing = [];
  let cachedCount = 0;

  // Check existence in small parallel batches
  for (let i = 0; i < PRECACHE_ASSETS.length; i += 24) {
    const slice = PRECACHE_ASSETS.slice(i, i + 24);
    const matches = await Promise.all(slice.map((url) => cache.match(url)));
    slice.forEach((url, idx) => {
      if (matches[idx]) {
        cachedCount++;
      } else {
        missing.push(url);
      }
    });
  }

  return {
    version: APP_VERSION,
    cacheName: CACHE_NAME,
    total: PRECACHE_ASSETS.length,
    cached: cachedCount,
    missing,
    complete: missing.length === 0
  };
}

async function ensureAllAssetsCached({ forceRefresh = false, reason = 'sync' } = {}) {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    await purgeOutdatedCaches();
    const cache = await caches.open(CACHE_NAME);

    if (forceRefresh) {
      await downloadAssetsWithProgress(cache, PRECACHE_ASSETS, {
        initialCompleted: 0,
        total: PRECACHE_ASSETS.length,
        reason
      });
    } else {
      const status = await inspectCacheStatus();
      if (status.missing.length > 0) {
        await downloadAssetsWithProgress(cache, status.missing, {
          initialCompleted: status.cached,
          total: status.total,
          reason
        });
      }
    }

    const finalStatus = await inspectCacheStatus();
    await broadcastToClients({
      type: 'CACHE_STATUS',
      status: finalStatus
    });
    return finalStatus;
  })();

  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

// Install: Download EVERY app file, data file, icon, sticker, wallpaper & demo archive up front bypassing HTTP cache
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await downloadAssetsWithProgress(cache, PRECACHE_ASSETS, {
        initialCompleted: 0,
        total: PRECACHE_ASSETS.length,
        reason: 'install'
      });
    })()
  );
});

// Activate: Purge obsolete Cache Storage caches, NEVER touch IndexedDB or localStorage
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await purgeOutdatedCaches();
      await self.clients.claim();
      const status = await inspectCacheStatus();
      await broadcastToClients({
        type: 'UPDATE_ACTIVATED',
        version: APP_VERSION,
        cacheName: CACHE_NAME,
        status
      });
    })()
  );
});

// Client messaging API for update checks, cache completeness checks, and forced cache sync
self.addEventListener('message', (event) => {
  const data = event.data || {};
  const replyPort = event.ports && event.ports[0];

  const reply = (payload) => {
    if (replyPort) {
      replyPort.postMessage(payload);
    } else if (event.source) {
      event.source.postMessage(payload);
    }
  };

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'GET_CACHE_STATUS') {
    event.waitUntil(
      inspectCacheStatus()
        .then((status) => reply({ type: 'CACHE_STATUS', status }))
        .catch((err) => reply({ type: 'CACHE_STATUS', error: err.message }))
    );
    return;
  }

  if (data.type === 'SYNC_CACHE') {
    event.waitUntil(
      ensureAllAssetsCached({
        forceRefresh: Boolean(data.forceRefresh),
        reason: data.reason || 'sync'
      })
        .then((status) => reply({ type: 'CACHE_STATUS', status }))
        .catch((err) => reply({ type: 'CACHE_STATUS', error: err.message }))
    );
  }
});

// Fetch: Never cache version.json; Cache-first for all media & offline assets; fresh/cached fallback for navigation & code
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignore cross-origin or browser-extension schemes
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never serve version.json from cache so GitHub Pages update checks are always authoritative
  if (url.pathname.endsWith('/version.json') || url.pathname === '/version.json') {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(
        () => new Response(JSON.stringify({ offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        })
      )
    );
    return;
  }

  // Handle SPA navigation requests (Opening or refreshing app offline or online)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        if (self.navigator && self.navigator.onLine !== false) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3500);
            const networkResponse = await fetch('./index.html', {
              cache: 'no-store',
              signal: controller.signal
            });
            clearTimeout(timer);

            if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
              const cache = await caches.open(CACHE_NAME);
              await Promise.all([
                cache.put('./index.html', networkResponse.clone()),
                cache.put('./', networkResponse.clone())
              ]);
              return networkResponse;
            }
          } catch (e) {
            // Network unavailable or slow -> fall back immediately to cached HTML
          }
        }

        const cached = await caches.match('./index.html') ||
          await caches.match('./') ||
          await caches.match(request) ||
          await caches.match('index.html');
        if (cached) return cached;

        try {
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match('./index.html') || await cache.match('./');
          if (fallback) return fallback;
        } catch (e) { }

        return new Response('WhatsApp', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      })()
    );
    return;
  }

  // Cache-first for all bundled media, icons, stickers, archives, and vendor scripts
  const isStaticMedia = url.pathname.includes('/assets/wallpapers/') ||
    url.pathname.includes('/assets/icons/') ||
    url.pathname.includes('/assets/stickers/') ||
    url.pathname.includes('/assets/data/') ||
    url.pathname.includes('/vendor/') ||
    url.pathname.endsWith('.zip');

  if (isStaticMedia) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (self.navigator && self.navigator.onLine === false) {
          return new Response('', { status: 404, statusText: 'Not Found' });
        }

        try {
          const networkResponse = await fetch(new Request(request, { cache: 'reload' }));
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        } catch (e) {
          return new Response('', { status: 404, statusText: 'Not Found' });
        }
      })()
    );
    return;
  }

  // App modules & styles: Serve current version cache immediately (version updates trigger clean cache replacement)
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      } catch (err) {
        return new Response('', { status: 404, statusText: 'Not Found' });
      }
    })()
  );
});
