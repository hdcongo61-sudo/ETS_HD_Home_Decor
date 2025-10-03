/* eslint-disable no-restricted-globals */
// This service worker can be customized. See https://cra.link/PWA

const CACHE_PREFIX = 'ets-hd-cache';
const PRECACHE = `${CACHE_PREFIX}-precache-v1`;
const RUNTIME = `${CACHE_PREFIX}-runtime`;

const APP_SHELL = ['/','/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(APP_SHELL)).then(self.skipWaiting)
  );
});

self.addEventListener('activate', (event) => {
  const currentCaches = [PRECACHE, RUNTIME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            return caches.delete(cacheName);
          }
          return null;
        })
      ).then(() => self.clients.claim())
    )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (request.url.includes('/api/')) {
    event.respondWith(
      caches.open(RUNTIME).then((cache) =>
        fetch(request)
          .then((response) => {
            cache.put(request, response.clone());
            return response;
          })
          .catch(() => cache.match(request))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return caches.open(RUNTIME).then((cache) =>
        fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cachedResponse)
      );
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
