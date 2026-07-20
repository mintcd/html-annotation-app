import assert from 'node:assert/strict';
import test from 'node:test';

import {
  frameCacheName,
  normalizeFrameUrl,
  stableFrameId,
} from '../core/frame/cache.ts';
import {
  FRAME_CACHE_SCOPE_PARAM,
  stripFrameCacheScopeFromSearch,
  withFrameCacheScope,
} from '../core/frame/cacheScope.ts';

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
    'annotation-frame-v2-20d3de5f4f7a5ec3',
  );
  assert.notEqual(
    frameCacheName('/frame/site/docs?q=1', 'https://annotation.test'),
    frameCacheName('/frame/site/docs?q=2', 'https://annotation.test'),
  );
});

test('adds a user-derived cache scope to frame URLs', () => {
  const scoped = withFrameCacheScope(
    '/frame/site/docs?q=1',
    'User_1',
    'https://annotation.test/app',
  );
  const url = new URL(scoped, 'https://annotation.test');

  assert.equal(scoped.startsWith('/frame/site/docs?'), true);
  assert.equal(url.searchParams.get('q'), '1');
  assert.match(url.searchParams.get(FRAME_CACHE_SCOPE_PARAM) ?? '', /^u-[0-9a-f]{16}$/);
});

test('cache scope partitions frame cache names without changing upstream search', () => {
  const first = withFrameCacheScope('/frame/site/docs?q=1', 'user-1', 'https://annotation.test');
  const second = withFrameCacheScope('/frame/site/docs?q=1', 'user-2', 'https://annotation.test');

  assert.notEqual(
    frameCacheName(first, 'https://annotation.test'),
    frameCacheName(second, 'https://annotation.test'),
  );
  assert.equal(stripFrameCacheScopeFromSearch(new URL(first, 'https://annotation.test').search), '?q=1');
});
