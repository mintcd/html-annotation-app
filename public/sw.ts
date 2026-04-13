/// <reference lib="webworker" />
/* Service Worker (TypeScript) - compiled to public/sw.js via `npm run build:sw` */
const CACHE_NAME = 'study-space-v1';
const FRAMES_CACHE = 'frames-cache-v1';
const SNAPSHOTS_CACHE = 'snapshots-cache-v1';

// Narrow the global `self` to a ServiceWorkerGlobalScope for service-worker-specific APIs
const sw = (self as unknown) as ServiceWorkerGlobalScope;

sw.addEventListener('install', (event: ExtendableEvent) => {
  console.log('Service worker installing');
  // Ensure the worker activates immediately
  try { event.waitUntil(sw.skipWaiting()); } catch (e) { /* ignore */ }
});

sw.addEventListener('activate', (event: ExtendableEvent) => {
  const cacheWhitelist = [CACHE_NAME, FRAMES_CACHE, SNAPSHOTS_CACHE];
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (cacheWhitelist.includes(k) ? Promise.resolve(true) : caches.delete(k))));
      try { await sw.clients.claim(); } catch (e) { /* ignore in non-sw env */ }
    } catch (e) {
      console.warn('SW activate cleanup failed', e);
    }
  })());
});


sw.addEventListener('fetch', (event: FetchEvent) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Snapshot-scoped asset proxy
  if (url.pathname.startsWith('/__snapshot_asset__/')) {
    event.respondWith((async () => {
      try {
        const cache = await caches.open(SNAPSHOTS_CACHE);
        // Try direct match
        try {
          const direct = await cache.match(request);
          if (direct) {
            console.debug('SW: serving snapshot asset direct match', request.url);
            return direct;
          }
        } catch (e) { /* ignore */ }

        // Decode original URL and try matching that
        const encoded = url.pathname.replace(/^\/__snapshot_asset__\//, '');
        const firstSlash = encoded.indexOf('/');
        let encodedUrl = encoded;
        if (firstSlash >= 0) encodedUrl = encoded.slice(firstSlash + 1);
        let originalUrl: string | null = null;
        try { originalUrl = decodeURIComponent(encodedUrl); } catch (e) { originalUrl = encodedUrl; }

        try {
          let cached = await cache.match(originalUrl as any);
          if (!cached) {
            const keys = await cache.keys();
            for (const k of keys) {
              if (k && k.url === originalUrl) {
                cached = await cache.match(k);
                if (cached) break;
              }
            }
          }
          if (cached) {
            console.debug('SW: serving snapshot asset from cache', originalUrl);
            return cached;
          }
        } catch (e) { /* ignore */ }

        // Network fallback
        try { return await fetch(originalUrl || request.url); } catch (e) { return new Response('', { status: 503 }); }
      } catch (e) {
        return new Response('', { status: 503 });
      }
    })());
    return;
  }

  // Prefer frames cache for proxied site assets
  if (url.pathname.startsWith('/_proxy/')) {
    event.respondWith((async () => {
      try {
        const cache = await caches.open(FRAMES_CACHE);
        const direct = await cache.match(request);
        if (direct) return direct;
        const any = await caches.match(request);
        if (any) return any;
        const res = await fetch(request);
        if (res && res.ok) {
          try { await cache.put(request, res.clone()); } catch (e) { /* ignore */ }
        }
        return res;
      } catch (e) {
        return fetch(request);
      }
    })());
    return;
  }

  // Cache common static assets
  const staticExts = /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/;
  if (url.pathname.startsWith('/_next/static/') || staticExts.test(url.pathname)) {
    event.respondWith((async () => {
      try {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (!response || response.status !== 200) return response;
        const cache = await caches.open(CACHE_NAME);
        try { await cache.put(request, response.clone()); } catch (e) { /* ignore */ }
        return response;
      } catch (e) {
        return new Response('', { status: 503 });
      }
    })());
    return;
  }
});
