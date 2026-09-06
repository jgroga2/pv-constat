const CACHE_NAME = 'pv-constat-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './app.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force l'activation immédiate sans attendre la fermeture de l'application
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // Supprime l'ancien cache v1
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
