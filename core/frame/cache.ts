const FRAME_CACHE_VERSION = 'v2';
const FRAME_CACHE_PREFIX = `annotation-frame-${FRAME_CACHE_VERSION}-`;
const FRAME_WORKER_PATH = '/sw.js';
const FRAME_WORKER_SCOPE = '/';
const FRAME_REFRESH_HEADER = 'X-Annotation-Frame-Refresh';
const FRAME_ERROR_HEADER = 'X-Annotation-Frame-Error';
const WORKER_READY_TIMEOUT_MS = 2_000;
const FRAME_LOAD_TIMEOUT_MS = 45_000;

type WorkerReply = {
  type: string;
  requestId?: string;
  error?: string;
};

let workerReadyPromise: Promise<ServiceWorker | undefined> | undefined;

export function normalizeFrameUrl(frameUrl: string, base?: string): string {
  const fallbackBase = base
    ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const url = new URL(frameUrl, fallbackBase);
  url.hash = '';
  return url.href;
}

export function stableFrameId(value: string): string {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }

  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}

export function frameCacheName(frameUrl: string, base?: string): string {
  const normalized = normalizeFrameUrl(frameUrl, base);
  return `${FRAME_CACHE_PREFIX}${stableFrameId(normalized)}`;
}

export async function ensureFrameCacheReady(): Promise<boolean> {
  return Boolean(await getFrameCacheWorker());
}

export async function refreshFrameBundle(
  frameUrl: string,
  iframe: HTMLIFrameElement,
): Promise<void> {
  const normalized = normalizeFrameUrl(frameUrl);
  const worker = await getFrameCacheWorker();
  if (!worker) {
    throw new Error('The local page cache is not ready. Reload the app and try again.');
  }

  const response = await fetch(normalized, {
    cache: 'reload',
    credentials: 'same-origin',
    headers: { [FRAME_REFRESH_HEADER]: '1' },
  });

  if (!response.ok || response.headers.get(FRAME_ERROR_HEADER) === '1') {
    const detail = response.headers.get(FRAME_ERROR_HEADER) === '1'
      ? 'The source page could not be fetched.'
      : `The source page returned ${response.status}.`;
    throw new Error(detail);
  }

  // Store explicitly as well as through the worker. This covers the short
  // activation window where the newly installed worker is active but has not
  // claimed the outer application document yet.
  const cache = await caches.open(frameCacheName(normalized));
  await cache.put(normalized, response.clone());

  await sendWorkerRequest(worker, {
    type: 'ANNOTATION_FRAME_REFRESH_ASSETS',
    frameUrl: normalized,
    durationMs: 60_000,
  }, ['ANNOTATION_FRAME_REFRESH_READY']);

  await reloadFrame(iframe, normalized);
}

export async function deleteFrameBundle(frameUrl: string): Promise<void> {
  const normalized = normalizeFrameUrl(frameUrl);
  const worker = await getFrameCacheWorker();

  if (worker) {
    await sendWorkerRequest(worker, {
      type: 'ANNOTATION_FRAME_CACHE_DELETE',
      frameUrl: normalized,
    }, ['ANNOTATION_FRAME_CACHE_DELETED']);
    return;
  }

  await caches.delete(frameCacheName(normalized));
}

async function getFrameCacheWorker(): Promise<ServiceWorker | undefined> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return undefined;
  }

  if (!workerReadyPromise) {
    workerReadyPromise = findFrameCacheWorker().finally(() => {
      workerReadyPromise = undefined;
    });
  }

  return workerReadyPromise;
}

async function findFrameCacheWorker(): Promise<ServiceWorker | undefined> {
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register(FRAME_WORKER_PATH, {
      scope: FRAME_WORKER_SCOPE,
      updateViaCache: 'none',
    });
  } catch {
    return undefined;
  }

  const deadline = Date.now() + WORKER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const candidates = [
      navigator.serviceWorker.controller,
      registration.active,
    ].filter((worker, index, list): worker is ServiceWorker => (
      Boolean(worker) && list.indexOf(worker) === index
    ));

    for (const worker of candidates) {
      if (await pingWorker(worker)) return worker;
    }

    await delay(75);
  }

  return undefined;
}

async function pingWorker(worker: ServiceWorker): Promise<boolean> {
  try {
    await sendWorkerRequest(worker, {
      type: 'ANNOTATION_FRAME_CACHE_PING',
    }, ['ANNOTATION_FRAME_CACHE_PONG'], 200);
    return true;
  } catch {
    return false;
  }
}

async function sendWorkerRequest(
  worker: ServiceWorker,
  message: Record<string, unknown>,
  successTypes: string[],
  timeoutMs = 2_000,
): Promise<WorkerReply> {
  const requestId = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('The page-cache worker did not respond.'));
    }, timeoutMs);

    channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (!reply || reply.requestId !== requestId) return;

      window.clearTimeout(timeout);
      channel.port1.close();
      if (successTypes.includes(reply.type)) resolve(reply);
      else reject(new Error(reply.error || 'The page-cache worker rejected the request.'));
    };

    try {
      worker.postMessage({ ...message, requestId }, [channel.port2]);
    } catch (error) {
      window.clearTimeout(timeout);
      channel.port1.close();
      reject(error);
    }
  });
}

function reloadFrame(iframe: HTMLIFrameElement, frameUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('The refreshed page took too long to load.'));
    }, FRAME_LOAD_TIMEOUT_MS);

    const handleLoad = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('The refreshed page could not be loaded.'));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };

    iframe.addEventListener('load', handleLoad, { once: true });
    iframe.addEventListener('error', handleError, { once: true });
    iframe.src = frameUrl;
  });
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}
