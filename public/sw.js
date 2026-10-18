/*
 * Stable service-worker entry point.
 *
 * The sync host and Workbox share this application-owned worker, so background
 * delivery uses the same replica registry as the page without replacing the
 * frame cache or the existing registration lifecycle.
 *
 * Workbox is imported from local npm packages (bundled by vite-plugin-pwa at
 * build time via Rollup). This means Workbox is never fetched from a CDN, so
 * caching strategies continue to work even when the device is offline.
 *
 */

// ─── Sync-engine worker ──────────────────────────────────────────────────
import { createSyncWorkerHost } from '@mintcd/sync-engine/pwa/worker';
import { createVinextWorkerOptions } from '@mintcd/sync-engine-vinext/worker';
import { model } from '../sync/model.generated';
import { runtime } from '../sync/runtime.generated';

const syncHost = createSyncWorkerHost({
  ...createVinextWorkerOptions(model, runtime),
  onError(error) {
    console.warn('[sync-worker] Synchronization failed', error);
  },
});

// The host claims only its versioned protocol and configured replica keys.
// Its handlers attach their work with waitUntil before returning.
self.addEventListener('message', (event) => {
  syncHost.handleMessage(event);
});
self.addEventListener('sync', (event) => {
  syncHost.handleSync(event);
});

// ─── Workbox — locally bundled, never from CDN ────────────────────────────
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import {
  registerRoute,
  NavigationRoute,
} from 'workbox-routing';
import {
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// ─── Skip-waiting support ─────────────────────────────────────────────────
// ServiceWorkerRegister.tsx sends this when a new SW is installed so users
// get updates immediately instead of waiting for all tabs to close.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Precache the app shell ────────────────────────────────────────────────
// self.__WB_MANIFEST is replaced at build time by vite-plugin-pwa with the
// versioned list of every JS/CSS/HTML/font/image asset in the build output.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ─── Navigation (SPA) fallback ────────────────────────────────────────────
// For any page navigation that isn't a frame/proxy URL, serve the precached
// root document so the app shell loads offline.
const appShellHandler = new NetworkFirst({
  cacheName: 'app-shell-v1',
  plugins: [
    new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 7 * 24 * 60 * 60 }),
  ],
});

registerRoute(
  new NavigationRoute(async (context) => {
    const url = new URL(context.request.url);
    // Frame and proxy routes are handled by the frame-cache IIFE below
    if (
      url.pathname.startsWith('/frame/') ||
      url.pathname.startsWith('/proxy/')
    ) {
      return fetch(context.request).catch(async () => {
        const cache = await caches.open('html-snapshots-v1');
        const cached = await cache.match(context.request);
        return (
          cached ??
          new Response('Offline: snapshot not found.', { status: 503 })
        );
      });
    }

    try {
      return await appShellHandler.handle(context);
    } catch {
      // Last-resort offline page served from precache
      const cached =
        (await caches.match('/')) ?? (await caches.match('/index.html'));
      if (cached) return cached;

      return new Response(
        '<!doctype html><html><head><title>Offline</title></head><body>' +
          '<h1>You are offline</h1>' +
          '<p>The app could not load. Please reconnect and refresh.</p>' +
          '</body></html>',
        { headers: { 'Content-Type': 'text/html' } },
      );
    }
  }),
);

// ─── Static assets: JS/CSS/fonts (cache-first, long TTL) ──────────────────
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  }),
);

// ─── Images (stale-while-revalidate) ──────────────────────────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

// Session responses must reach the server to count as verified. Offline
// identity recovery is handled explicitly by the client session cache.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('api-session-v1'));
});

// ─── Frame-cache logic ─────────────────────────────────────────────────────
// Handles caching of annotated HTML frames and their sub-resources.
// Placed after Workbox routes so app-shell navigations take priority.
(() => {
  'use strict';

  const FRAME_CACHE_VERSION = 'v2';
  const FRAME_CACHE_PREFIX = `annotation-frame-${FRAME_CACHE_VERSION}-`;
  const FRAME_CACHE_FAMILY = 'annotation-frame-v';
  const LOGO_CACHE_VERSION = 'v1';
  const LOGO_CACHE = `annotation-site-logo-${LOGO_CACHE_VERSION}`;
  const LOGO_CACHE_FAMILY = 'annotation-site-logo-';
  const CONTROL_CACHE = `annotation-frame-control-${FRAME_CACHE_VERSION}`;
  const CONTROL_CACHE_FAMILY = 'annotation-frame-control-';
  const LEGACY_CACHE = 'frames-cache-v1';
  const FRAME_PATH_PREFIX = '/frame/';
  const LOGO_PATH = '/api/website-logo';
  const REFRESH_HEADER = 'x-annotation-frame-refresh';
  const FRAME_ERROR_HEADER = 'x-annotation-frame-error';
  const DEFAULT_REFRESH_WINDOW_MS = 60_000;

  const CACHEABLE_DESTINATIONS = new Set([
    'audio',
    'audioworklet',
    'embed',
    'font',
    'image',
    'manifest',
    'object',
    'paintworklet',
    'script',
    'sharedworker',
    'style',
    'track',
    'video',
    'worker',
    'xslt',
  ]);

  const refreshUntilByFrame = new Map();

  self.addEventListener('activate', (event) => {
    event.waitUntil(cleanOldFrameCaches().catch(() => undefined));
  });

  self.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data.type !== 'string') return;
    if (data.type === 'SKIP_WAITING') return; // handled above

    if (data.type === 'ANNOTATION_FRAME_CACHE_PING') {
      reply(event, {
        type: 'ANNOTATION_FRAME_CACHE_PONG',
        requestId: data.requestId,
        version: FRAME_CACHE_VERSION,
      });
      return;
    }

    if (data.type === 'ANNOTATION_FRAME_REFRESH_ASSETS') {
      event.waitUntil(
        beginAssetRefresh(data).then(
          (result) =>
            reply(event, {
              type: 'ANNOTATION_FRAME_REFRESH_READY',
              requestId: data.requestId,
              ...result,
            }),
          (error) =>
            reply(event, {
              type: 'ANNOTATION_FRAME_REFRESH_ERROR',
              requestId: data.requestId,
              error: error instanceof Error ? error.message : String(error),
            }),
        ),
      );
      return;
    }

    if (data.type === 'ANNOTATION_FRAME_CACHE_DELETE') {
      event.waitUntil(
        deleteFrameCache(data.frameUrl).then(
          () =>
            reply(event, {
              type: 'ANNOTATION_FRAME_CACHE_DELETED',
              requestId: data.requestId,
            }),
          (error) =>
            reply(event, {
              type: 'ANNOTATION_FRAME_CACHE_DELETE_ERROR',
              requestId: data.requestId,
              error: error instanceof Error ? error.message : String(error),
            }),
        ),
      );
    }
  });

  self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || request.headers.has('range')) return;

    if (isFrameDocumentUrl(request.url)) {
      event.respondWith(serveFrameRequest(event, request.url));
      return;
    }

    if (isWebsiteLogoUrl(request.url)) {
      event.respondWith(serveWebsiteLogo(event));
      return;
    }

    if (!CACHEABLE_DESTINATIONS.has(request.destination)) return;
    event.respondWith(servePotentialFrameAsset(event));
  });

  async function serveWebsiteLogo(event) {
    let cache;
    try {
      cache = await caches.open(LOGO_CACHE);
    } catch {
      return fetch(event.request);
    }
    const cached = await matchSafely(cache, event.request);
    if (cached) {
      event.waitUntil(
        refreshWebsiteLogo(cache, event.request).catch(() => undefined),
      );
      return cached;
    }
    return refreshWebsiteLogo(cache, event.request);
  }

  async function refreshWebsiteLogo(cache, request) {
    const response = await fetch(request);
    if (canStoreLogo(response)) {
      await putSafely(cache, request, response.clone());
    }
    return response;
  }

  async function servePotentialFrameAsset(event) {
    let client;
    try {
      client = event.clientId
        ? await self.clients.get(event.clientId)
        : undefined;
    } catch {
      return fetch(event.request);
    }
    if (!client || !isFrameDocumentUrl(client.url)) {
      return fetch(event.request);
    }
    return serveFrameRequest(event, client.url);
  }

  async function serveFrameRequest(event, rawFrameUrl) {
    const frameUrl = normalizeFrameUrl(rawFrameUrl);
    const frameId = stableFrameId(frameUrl);
    const request = event.request;
    const isDocument = isFrameDocumentUrl(request.url);
    const explicitRefresh = request.headers.get(REFRESH_HEADER) === '1';
    let cache;

    try {
      cache = await caches.open(`${FRAME_CACHE_PREFIX}${frameId}`);
    } catch {
      return fetch(request);
    }

    if (explicitRefresh) {
      return replaceFromNetwork(cache, request, isDocument);
    }

    const refreshAssets =
      !isDocument && (await isAssetRefreshActive(frameId).catch(() => false));
    if (isDocument && request.cache === 'reload') {
      await beginAssetRefresh({
        frameUrl,
        durationMs: DEFAULT_REFRESH_WINDOW_MS,
      }).catch(() => undefined);
    }
    if (refreshAssets || request.cache === 'reload') {
      return networkFirst(cache, request, isDocument, refreshAssets);
    }

    const cached = await matchSafely(cache, request);
    if (cached) return cached;

    const response = await fetch(request);
    if (canStore(response, isDocument)) {
      event.waitUntil(putSafely(cache, request, response.clone()));
    }
    return response;
  }

  async function replaceFromNetwork(cache, request, isDocument) {
    const response = await fetch(request);
    if (canStore(response, isDocument)) {
      await putSafely(cache, request, response.clone());
    }
    return response;
  }

  async function networkFirst(
    cache,
    request,
    isDocument,
    bypassHttpCache = false,
  ) {
    try {
      const networkRequest = bypassHttpCache
        ? new Request(request, { cache: 'reload' })
        : request;
      const response = await fetch(networkRequest);
      if (canStore(response, isDocument)) {
        await putSafely(cache, request, response.clone());
        return response;
      }
      const cached = await matchSafely(cache, request);
      return cached || response;
    } catch (error) {
      const cached = await matchSafely(cache, request);
      if (cached) return cached;
      throw error;
    }
  }

  function canStore(response, isDocument) {
    if (!(response.ok || response.type === 'opaque')) return false;
    if (isDocument && response.headers.get(FRAME_ERROR_HEADER) === '1')
      return false;
    return response.status !== 206 && response.headers.get('vary') !== '*';
  }

  function canStoreLogo(response) {
    const contentType = response.headers.get('content-type') || '';
    return (
      response.ok &&
      response.status !== 206 &&
      response.headers.get('vary') !== '*' &&
      contentType.toLowerCase().startsWith('image/')
    );
  }

  async function matchSafely(cache, request) {
    try {
      return await cache.match(request);
    } catch {
      return undefined;
    }
  }

  async function putSafely(cache, request, response) {
    try {
      await cache.put(request, response);
    } catch {
      // Quota and unsupported-response failures must not block the live page.
    }
  }

  async function beginAssetRefresh(data) {
    const frameUrl = normalizeFrameUrl(data.frameUrl);
    if (!isFrameDocumentUrl(frameUrl)) throw new Error('Invalid frame URL');

    const requestedDuration = Number(data.durationMs);
    const durationMs = Number.isFinite(requestedDuration)
      ? Math.min(Math.max(requestedDuration, 5_000), 60_000)
      : DEFAULT_REFRESH_WINDOW_MS;
    const frameId = stableFrameId(frameUrl);
    const until = Date.now() + durationMs;

    refreshUntilByFrame.set(frameId, until);
    try {
      const controlCache = await caches.open(CONTROL_CACHE);
      await controlCache.put(
        controlRequest(frameId),
        new Response(String(until)),
      );
    } catch {
      // In-memory marker still refreshes the current load.
    }

    return { frameId, until };
  }

  async function isAssetRefreshActive(frameId) {
    const now = Date.now();
    const inMemory = refreshUntilByFrame.get(frameId) || 0;
    if (inMemory > now) return true;
    refreshUntilByFrame.delete(frameId);

    let controlCache;
    let stored;
    try {
      controlCache = await caches.open(CONTROL_CACHE);
      stored = await controlCache.match(controlRequest(frameId));
    } catch {
      return false;
    }
    const until = stored ? Number(await stored.text()) : 0;
    if (until > now) {
      refreshUntilByFrame.set(frameId, until);
      return true;
    }

    if (stored) await controlCache.delete(controlRequest(frameId));
    return false;
  }

  async function deleteFrameCache(rawFrameUrl) {
    const frameUrl = normalizeFrameUrl(rawFrameUrl);
    const frameId = stableFrameId(frameUrl);
    refreshUntilByFrame.delete(frameId);

    await caches.delete(`${FRAME_CACHE_PREFIX}${frameId}`);
    try {
      const controlCache = await caches.open(CONTROL_CACHE);
      await controlCache.delete(controlRequest(frameId));
    } catch {
      // Stale refresh metadata will expire naturally.
    }
  }

  async function cleanOldFrameCaches() {
    const names = await caches.keys();
    await Promise.all(
      names.map((name) => {
        const isOldVersion =
          name.startsWith(FRAME_CACHE_FAMILY) &&
          !name.startsWith(FRAME_CACHE_PREFIX);
        const isOldControlCache =
          name.startsWith(CONTROL_CACHE_FAMILY) && name !== CONTROL_CACHE;
        const isOldLogoCache =
          name.startsWith(LOGO_CACHE_FAMILY) && name !== LOGO_CACHE;
        return name === LEGACY_CACHE ||
          isOldVersion ||
          isOldControlCache ||
          isOldLogoCache
          ? caches.delete(name)
          : Promise.resolve(false);
      }),
    );
  }

  function controlRequest(frameId) {
    return new Request(
      new URL(
        `/__annotation_frame_cache__/refresh/${frameId}`,
        self.location.origin,
      ),
    );
  }

  function normalizeFrameUrl(value) {
    const url = new URL(String(value), self.location.origin);
    url.hash = '';
    return url.href;
  }

  function isFrameDocumentUrl(value) {
    try {
      const url = new URL(value, self.location.origin);
      return (
        url.origin === self.location.origin &&
        url.pathname.startsWith(FRAME_PATH_PREFIX)
      );
    } catch {
      return false;
    }
  }

  function isWebsiteLogoUrl(value) {
    try {
      const url = new URL(value, self.location.origin);
      return (
        url.origin === self.location.origin &&
        url.pathname === LOGO_PATH &&
        url.searchParams.has('url')
      );
    } catch {
      return false;
    }
  }

  function stableFrameId(value) {
    let left = 0x811c9dc5;
    let right = 0x9e3779b9;
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      left = Math.imul(left ^ code, 0x01000193);
      right = Math.imul(right ^ code, 0x85ebca6b);
    }
    return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
  }

  function reply(event, payload) {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(payload);
      return;
    }
    if (event.source && typeof event.source.postMessage === 'function') {
      event.source.postMessage(payload);
    }
  }
})();
