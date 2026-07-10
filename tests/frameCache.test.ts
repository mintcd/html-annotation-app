import assert from 'node:assert/strict';
import test from 'node:test';

import {
  frameCacheName,
  normalizeFrameUrl,
  stableFrameId,
} from '../utils/frameCache.ts';

test('normalizes frame cache keys to absolute URLs without fragments', () => {
  assert.equal(
    normalizeFrameUrl('/_frame/site/docs?q=1#selection', 'https://annotation.test/app'),
    'https://annotation.test/_frame/site/docs?q=1',
  );
});

test('uses a stable versioned cache name for each full frame URL', () => {
  const url = 'https://annotation.test/_frame/site/docs?q=1';
  assert.equal(stableFrameId(url), 'a5f6267c1dcd11f0');
  assert.equal(
    frameCacheName('/_frame/site/docs?q=1', 'https://annotation.test/app'),
    'annotation-frame-v1-a5f6267c1dcd11f0',
  );
  assert.notEqual(
    frameCacheName('/_frame/site/docs?q=1', 'https://annotation.test'),
    frameCacheName('/_frame/site/docs?q=2', 'https://annotation.test'),
  );
});
