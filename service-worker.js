/* BotwaveBomba service worker — v3 reset: clears any stale caches and unregisters. */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) { return caches.delete(name); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    self.clients.claim().then(function () {
      return self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
