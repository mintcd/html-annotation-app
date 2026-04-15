/// <reference lib="webworker" />
/* Service Worker (TypeScript) - compiled to public/sw.js via `npm run build:sw` */
const CACHE_NAME = 'study-space-v1';
const FRAMES_CACHE = 'frames-cache-v1';
const SNAPSHOTS_CACHE = 'snapshots-cache-v1';
const PRECACHE_URLS = ['/offline.html'];

// Narrow the global `self` to a ServiceWorkerGlobalScope for service-worker-specific APIs
const sw = (self as unknown) as ServiceWorkerGlobalScope;

sw.addEventListener('install', (event: ExtendableEvent) => {
  console.log('Service worker installing');
  // Precache essential offline assets and activate immediately
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
    } catch (e) { /* ignore */ }
    try { await sw.skipWaiting(); } catch (e) { /* ignore */ }
  })());
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

const actions = {
  updateRemote: 'UPDATE_REMOTE',
  updateRemoteResult: 'UPDATE_REMOTE_RESULT',
  updateRemoteError: 'UPDATE_REMOTE_ERROR',
  registerSync: 'REGISTER_SYNC',
  backgroundSync: 'BACKGROUND_SYNC'
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open('annotation-db', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('operations')) db.createObjectStore('operations', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

function getAllOperations(): Promise<any[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const tx = db.transaction('operations', 'readonly');
      const store = tx.objectStore('operations');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

function putOperation(op: any): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const tx = db.transaction('operations', 'readwrite');
      const store = tx.objectStore('operations');
      const req = store.put(op);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function notifyClients(message: any) {
  try {
    const clients = await sw.clients.matchAll();
    for (const c of clients) {
      try { c.postMessage(message); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
}

async function processPendingOperations(limit = 50) {
  console.log('SW: processing pending operations');
  const ops = await getAllOperations();
  const pending = (ops || []).filter((o: any) => !o.processed);
  if (!pending.length) return;
  pending.sort((a: any, b: any) => (Number(a.created_at) || 0) - (Number(b.created_at) || 0));
  const batch = pending.slice(0, limit);
  for (const op of batch) {
    try {
      if (op.op_type === 'insert') {
        if (op.entity === 'pages') {
          await fetch('/api/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op.payload) });
        } else if (op.entity === 'annotations') {
          const body = {
            url: op.payload.page_id,
            text: op.payload.text,
            html: op.payload.html,
            color: op.payload.color,
            comment: op.payload.comment,
            position: op.payload.position,
          };
          await fetch('/api/annotations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } else if (op.entity === 'websites') {
          await fetch('/api/websites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op.payload) });
        }
      } else if (op.op_type === 'update') {
        if (op.entity === 'pages') {
          let url = (op.payload && op.payload.url) || undefined;
          if (!url && op.payload && op.payload.id) {
            try {
              const db = await openDB();
              const rtx = db.transaction('pages', 'readonly');
              const store = rtx.objectStore('pages');
              const req = store.get(op.payload.id);
              url = await new Promise((res, rej) => { req.onsuccess = () => res(req.result ? req.result.url : undefined); req.onerror = () => rej(req.error); });
            } catch (e) { /* ignore */ }
          }
          const body = { url, ...(op.payload.changes || {}) };
          await fetch('/api/pages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } else if (op.entity === 'annotations') {
          const body = { id: op.payload.id, ...(op.payload.changes || {}) };
          await fetch('/api/annotations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        }
      } else if (op.op_type === 'delete') {
        if (op.entity === 'pages') {
          let url = (op.payload && op.payload.url) || undefined;
          if (!url && op.payload && op.payload.id) {
            try {
              const db = await openDB();
              const rtx = db.transaction('pages', 'readonly');
              const store = rtx.objectStore('pages');
              const req = store.get(op.payload.id);
              url = await new Promise((res, rej) => { req.onsuccess = () => res(req.result ? req.result.url : undefined); req.onerror = () => rej(req.error); });
            } catch (e) { /* ignore */ }
          }
          await fetch(`/api/pages?url=${encodeURIComponent(url || '')}`, { method: 'DELETE' });
        } else if (op.entity === 'annotations') {
          const id = op.payload.id;
          await fetch(`/api/annotations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        }
      }

      try { op.processed = true; op.sent_at = Date.now(); await putOperation(op); } catch (e) { /* ignore */ }
      await notifyClients({ type: actions.updateRemoteResult, op });
    } catch (err) {
      try { op.attempts = (op.attempts || 0) + 1; op.last_error = String(err); await putOperation(op); } catch (e) { /* ignore */ }
      await notifyClients({ type: actions.updateRemoteError, op, error: String(err) });
      if (err && (((err as any).name === 'TypeError') || String(err).includes('Failed to fetch'))) throw err;
    }
  }
}

sw.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data;
  if (!data || typeof data.type !== 'string') return;
    if (data.type === actions.registerSync) {
    try { (sw.registration as any).sync?.register('annotation-sync'); } catch (e) { /* ignore */ }
    return;
  }
  if (data.type === actions.backgroundSync) {
    (async () => {
      try {
        await processPendingOperations();
      } catch (err) {
        try { (sw.registration as any).sync?.register('annotation-sync'); } catch (e) { /* ignore */ }
        await notifyClients({ type: actions.updateRemoteError, error: String(err), op: { backgroundSync: true } });
        return;
      }
      await notifyClients({ type: actions.updateRemoteResult, op: { backgroundSync: true } });
    })();
    return;
  }
  if (data.type === actions.updateRemote) {
    (async () => {
      try {
        await processPendingOperations();
      } catch (e) {
        try { (sw.registration as any).sync?.register('annotation-sync'); } catch (er) { /* ignore */ }
      }
    })();
    return;
  }
});

sw.addEventListener('sync', (ev: any) => {
  if (!ev || ev.tag !== 'annotation-sync') return;
  try { ev.waitUntil(processPendingOperations()); } catch (e) { /* ignore */ }
});


sw.addEventListener('fetch', (event: FetchEvent) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate' || ((request.headers.get('accept') || '').includes('text/html'))) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        return networkResponse;
      } catch (err) {
        try {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request);
          if (cached) return cached;
          const offline = await cache.match('/offline.html');
          if (offline) return offline;
        } catch (e) { /* ignore */ }
        return new Response('', { status: 503 });
      }
    })());
    return;
  }

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
