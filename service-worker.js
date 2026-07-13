/* BotwaveBomba service worker — v5 caching + offline fallback. */
const CACHE_VERSION = 'v5-2026-07-13';
const APP_SHELL = [
  '/botwavebomba/',
  '/botwavebomba/index.html',
  '/botwavebomba/offline.html',
  '/botwavebomba/404.html',
  '/botwavebomba/assets/css/botwave.css',
  '/botwavebomba/assets/js/botwave.js',
  '/botwavebomba/assets/js/story.js',
  '/botwavebomba/assets/logos/default.png',
  '/botwavebomba/manifest.json',
  '/botwavebomba/robots.txt',
  '/botwavebomba/sitemap.xml',
  '/botwavebomba/api/meta.json',
  '/botwavebomba/api/search_index.json',
  '/botwavebomba/api/corrections.json'
];

const STATIC_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) { return name !== CACHE_VERSION; })
          .map(function (name) { return caches.delete(name); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  const url = new URL(req.url);

  // Same-origin HTML: network-first, fallback to cache, then offline.html
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, clone); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (cached) {
            return cached || caches.match('/botwavebomba/offline.html');
          });
        })
    );
    return;
  }

  // API JSON: stale-while-revalidate, fallback to cache
  if (req.method === 'GET' && url.origin === self.location.origin && url.pathname.startsWith('/botwavebomba/api/')) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        const network = fetch(req)
          .then(function (res) {
            if (!res || res.status !== 200 || res.type !== 'basic') return res;
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, clone); });
            return res;
          })
          .catch(function () { return cached; });
        return cached || network;
      })
    );
    return;
  }

  // Static assets (CSS, JS, images, fonts): stale-while-revalidate
  if (
    req.method === 'GET' &&
    (url.origin === self.location.origin || STATIC_HOSTS.includes(url.hostname))
  ) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        const network = fetch(req)
          .then(function (res) {
            if (!res || res.status !== 200 || (res.type !== 'basic' && !STATIC_HOSTS.includes(url.hostname))) return res;
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, clone); });
            return res;
          })
          .catch(function () { return cached; });
        return cached || network;
      })
    );
    return;
  }
});
