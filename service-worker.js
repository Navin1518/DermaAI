const CACHE_NAME = 'dermacare-shell-v4';
const APP_SHELL = [
  new URL('./', self.registration.scope).href,
  new URL('index.html', self.registration.scope).href,
  new URL('manifest.webmanifest', self.registration.scope).href,
  new URL('icon-192.png?v=logo1', self.registration.scope).href,
  new URL('icon-512.png?v=logo1', self.registration.scope).href,
  new URL('apple-touch-icon.png?v=logo1', self.registration.scope).href
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('dermacare-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        return (await caches.match(request)) || caches.match(new URL('./', self.registration.scope).href);
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (request.mode === 'navigate') return caches.match(new URL('./', self.registration.scope).href);
      throw error;
    }
  })());
});
