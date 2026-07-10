'use client';

import { useSyncEngine } from '@mintcd/sync-engine';
import { finalConfig } from '../utils/engine';

export default function ServiceWorkerRegister() {
  // sync-engine generates /sw.sync.js. Register the stable wrapper so its
  // offline data sync and the annotated-page cache share one root worker.
  useSyncEngine({ ...finalConfig, swPath: '/sw.js' });

  return null;
}
