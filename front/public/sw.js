const STATIC_CACHE = 'vynx-pwa-v1';
const OFFLINE_URL = '/offline.html';
const PUBLIC_ASSETS = [OFFLINE_URL, '/android-chrome-192x192.png', '/android-chrome-512x512.png', '/android-chrome-maskable-512x512.png', '/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(PUBLIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key =>
      (key.startsWith('vynx-static-') || key.startsWith('vynx-pwa-')) && key !== STATIC_CACHE,
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Never store live pages, account responses, payment requests, or call tokens.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () =>
      (await caches.open(STATIC_CACHE)).match(OFFLINE_URL),
    ));
    return;
  }
  if (!url.pathname.startsWith('/_next/static/') && !PUBLIC_ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.status === 200 && response.type === 'basic') {
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
