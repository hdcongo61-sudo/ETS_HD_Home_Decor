/* eslint-disable no-restricted-globals */

// Basic caching strategy tailored for CRA build output.
const CACHE_PREFIX = 'ets-hd-cache';
const CACHE_VERSION = 'v2';
const PRECACHE = `${CACHE_PREFIX}-${CACHE_VERSION}-precache`;
const RUNTIME = `${CACHE_PREFIX}-${CACHE_VERSION}-runtime`;

const OFFLINE_URL = '/offline.html';
const APP_SHELL = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-icon.png'
];
const FALLBACK_ICON = '/icons/icon-192.png';
const FALLBACK_BADGE = '/icons/icon-192.png';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const currentCaches = [PRECACHE, RUNTIME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              return caches.delete(cacheName);
            }
            return null;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') {
    return;
  }

  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  if (requestUrl.pathname.startsWith('/api/')) {
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

  if (request.destination === 'image') {
    event.respondWith(
      caches
        .match(request)
        .then((cachedResponse) => cachedResponse || fetch(request))
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('/icons/icon-192.png'))
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
          .catch(
            () =>
              new Response('', {
                status: 503,
                statusText: 'Offline',
                headers: { 'Retry-After': '60' }
              })
          )
      );
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    payload = {
      title: 'Notification',
      body: event.data.text()
    };
  }

  const title = payload.title || 'ETS HD';
  const options = {
    body: payload.body || '',
    icon: payload.icon || FALLBACK_ICON,
    badge: payload.badge || FALLBACK_BADGE,
    data: payload.data || {},
    vibrate: payload.vibrate || [150, 100, 150],
    renotify: payload.renotify ?? false,
    requireInteraction: payload.requireInteraction ?? false
  };

  if (payload.tag) {
    options.tag = payload.tag;
  }

  if (Array.isArray(payload.actions)) {
    options.actions = payload.actions;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url;

  if (!targetUrl) {
    return;
  }

  const destination = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === destination) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(destination);
        }

        return null;
      })
  );
});
