// Service Worker for 智能记账工作台
// Enables offline functionality and PWA installation

const CACHE_NAME = 'finance-workbench-v6';
const CHART_JS_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';

// Files to cache for offline use
const CACHE_FILES = [
  './',
  './app.html',
  './记账工作台.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './favicon-16.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app files');
        // Cache local files first
        return cache.addAll(CACHE_FILES.filter(f => !f.startsWith('http')).map(f => f.replace('./', './')));
      })
      .then(() => {
        // Try to cache Chart.js (non-blocking)
        return caches.open(CACHE_NAME).then((cache) => {
          return fetch(CHART_JS_URL).then((res) => {
            if (res.ok) cache.put(CHART_JS_URL, res.clone());
          }).catch(() => {
            console.log('[SW] Chart.js offline cache failed (will try online)');
          });
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (except Chart.js CDN)
  const url = new URL(event.request.url);
  if (url.origin !== location.origin && url.href !== CHART_JS_URL) return;

  // Cache-first strategy for local files
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          // Cache new responses
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // If both cache and network fail, try to serve the main page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./app.html');
          }
        });
      })
    );
    return;
  }

  // For Chart.js CDN - try cache first, then network
  if (url.href === CHART_JS_URL) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});

// Message handler for updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
