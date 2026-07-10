import assert from 'node:assert/strict';
import test from 'node:test';

import {
  frameCacheName,
  normalizeFrameUrl,
  stableFrameId,
} from '../utils/frameCache.ts';

test('normalizes frame cache keys to absolute URLs without fragments', () => {
  assert.equal(
    normalizeFrameUrl('/frame/site/docs?q=1#selection', 'https://annotation.test/app'),
    'https://annotation.test/frame/site/docs?q=1',
  );
});

test('uses a stable versioned cache name for each full frame URL', () => {
  const url = 'https://annotation.test/frame/site/docs?q=1';
  assert.equal(stableFrameId(url), '20d3de5f4f7a5ec3');
  assert.equal(
    frameCacheName('/frame/site/docs?q=1', 'https://annotation.test/app'),
    'annotation-frame-v1-20d3de5f4f7a5ec3',
  );
  assert.notEqual(
    frameCacheName('/frame/site/docs?q=1', 'https://annotation.test'),
    frameCacheName('/frame/site/docs?q=2', 'https://annotation.test'),
  );
});
