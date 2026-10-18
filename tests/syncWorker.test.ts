import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import { build } from "vite";
import { runtime } from "../sync/runtime.generated.ts";

test("the bundled worker handles the sync protocol alongside frame-cache messages", async () => {
  const result = await build({
    configFile: false,
    publicDir: false,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{
      name: "worker-test-workbox",
      enforce: "pre",
      resolveId(source) {
        return source.startsWith("workbox-") ? `\0${source}` : undefined;
      },
      load(id) {
        if (!id.startsWith("\0workbox-")) return;
        // Workbox routing is independent of sync event ownership. Its native
        // implementation is bundled and checked by the production build.
        return `
          export const precacheAndRoute = () => {};
          export const cleanupOutdatedCaches = () => {};
          export const registerRoute = (...args) => globalThis.recordWorkerRoute(...args);
          export class NavigationRoute {}
          export class NetworkFirst {}
          export class CacheFirst {}
          export class StaleWhileRevalidate {}
          export class ExpirationPlugin {}
        `;
      },
    }],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: fileURLToPath(new URL("../public/sw.js", import.meta.url)),
        name: "AnnotationServiceWorker",
        formats: ["iife"],
      },
    },
  });
  const bundles = Array.isArray(result) ? result : [result];
  const chunk = bundles.flatMap(bundle => "output" in bundle ? bundle.output : [])
    .find(item => item.type === "chunk");
  assert.ok(chunk && chunk.type === "chunk");

  const listeners = new Map<string, ((event: unknown) => void)[]>();
  type RoutePredicate = (context: { request: { destination: string }; url: URL }) => boolean;
  const routePredicates: RoutePredicate[] = [];
  const deletedCaches: string[] = [];
  let skipped = false;
  const context = vm.createContext({
    self: {
      location: { origin: "https://annotation.test" },
      addEventListener(type: string, listener: (event: unknown) => void) {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      skipWaiting() { skipped = true; },
    },
    URL, TextEncoder, TextDecoder, AbortController,
    crypto: globalThis.crypto, structuredClone, setTimeout, clearTimeout,
    console: { warn() {} },
    recordWorkerRoute(predicate: unknown) {
      if (typeof predicate === "function") routePredicates.push(predicate as RoutePredicate);
    },
    caches: {
      async delete(name: string) { deletedCaches.push(name); return true; },
      async keys() { return []; },
    },
  });
  new vm.Script(chunk.code).runInContext(context);

  function dispatch(type: string, data: unknown) {
    const pending: Promise<unknown>[] = [];
    const replies: unknown[] = [];
    const event = {
      data,
      tag: data,
      ports: [{ postMessage(reply: unknown) { replies.push(reply); } }],
      waitUntil(work: Promise<unknown>) { pending.push(work); },
    };
    for (const listener of listeners.get(type) ?? []) listener(event);
    return { pending, replies };
  }

  const hello = dispatch("message", {
    type: "sync-engine:pwa", version: 1,
    contractVersion: runtime.contractVersion, replicaKey: "main",
    id: "hello-1", command: "hello",
  });
  assert.equal(hello.pending.length, 1, "sync work extends the worker event synchronously");
  await Promise.all(hello.pending);
  assert.equal((hello.replies[0] as { ok: boolean }).ok, true);

  const frame = dispatch("message", {
    type: "ANNOTATION_FRAME_CACHE_PING", requestId: "frame-1",
  });
  assert.equal(frame.pending.length, 0);
  assert.equal((frame.replies[0] as { type: string }).type, "ANNOTATION_FRAME_CACHE_PONG");

  dispatch("message", { type: "SKIP_WAITING" });
  assert.equal(skipped, true);
  assert.equal(dispatch("sync", "unrelated-background-task").pending.length, 0);
  const background = dispatch("sync", "sync-engine:pwa:main");
  assert.equal(background.pending.length, 1);
  // No replica is initialized in this worker context. The host must settle the
  // event without creating anonymous state or interfering with other handlers.
  await Promise.all(background.pending);

  const sessionRequest = {
    method: "GET", destination: "", headers: new Headers(),
    url: "https://annotation.test/api/auth/session",
  };
  assert.equal(routePredicates.some(predicate => predicate({
    request: sessionRequest, url: new URL(sessionRequest.url),
  })), false, "auth session responses bypass Workbox runtime caches");
  for (const listener of listeners.get("fetch") ?? []) listener({
    request: sessionRequest,
    respondWith() { assert.fail("The frame cache must not handle session requests"); },
  });
  const activated = dispatch("activate", undefined);
  await Promise.all(activated.pending);
  assert.ok(deletedCaches.includes("api-session-v1"), "activation removes old cached sessions");
});
