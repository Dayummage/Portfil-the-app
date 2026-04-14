// Portfl Service Worker v2 — Full offline-first PWA
const CACHE_NAME = 'portfl-v2.1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── Install: pre-cache all static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches and claim clients immediately ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Notify all clients that an update was applied
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
          });
        });
      })
  );
});

// ── Fetch: Cache-first for static assets, network-first for navigation ──
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // For navigation requests (page loads), try network first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For everything else, cache-first with network fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Return cached version, but also update cache in background (stale-while-revalidate)
        const fetchPromise = fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => {/* offline, cached version is fine */});

        return cached;
      }

      // Not in cache — fetch from network and cache
      return fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for uncached requests
        if (request.destination === 'document') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

// ── Background Sync: queue data operations for when back online ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-portfolio') {
    // Future: sync portfolio data to a server
    console.log('[Portfl SW] Background sync triggered');
  }
});

// ── Push notifications (future-ready) ──
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification(data.title || 'Portfl', {
      body: data.body || 'You have an update',
      icon: './icon-192.png',
      badge: './icon-192.png',
    });
  }
});
