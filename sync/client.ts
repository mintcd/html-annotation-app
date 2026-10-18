"use client";

import { createVinextSyncEngine } from "@mintcd/sync-engine-vinext/client";
import type { VinextClientOptions } from "@mintcd/sync-engine-vinext/client";
import { model } from "./model.generated";
import { runtime } from "./runtime.generated";

export { logoutSync } from "./client.generated";

// The application owns its Workbox worker and registration. Enable the
// package's worker coordinator against that host; unavailable workers retain
// the package's foreground synchronization fallback.
export const createSyncEngine = (options: VinextClientOptions) =>
  createVinextSyncEngine(model, { ...runtime, pwa: true }, options);

export type Engine = Awaited<ReturnType<typeof createSyncEngine>>;
