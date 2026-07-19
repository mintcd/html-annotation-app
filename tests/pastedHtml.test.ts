import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeWebpageStoragePath,
  webpageStorageKey,
} from '../core/frame/pastedHtml.ts';

test('builds the root pasted HTML storage key from a route site id', () => {
  assert.equal(webpageStorageKey('example-com', undefined), 'example-com');
});

test('builds nested pasted HTML storage keys from route path segments', () => {
  assert.equal(
    webpageStorageKey('example-com', ['article', '10.1007']),
    'example-com/article/10.1007',
  );
  assert.equal(
    webpageStorageKey('example-com', 'article/10.1007'),
    'example-com/article/10.1007',
  );
});

test('normalizes leading and trailing slashes from storage paths', () => {
  assert.equal(normalizeWebpageStoragePath('/article/10.1007/'), 'article/10.1007');
});

test('rejects full URLs as pasted HTML site ids', () => {
  assert.throws(
    () => webpageStorageKey('https://example.com', 'article'),
    /Invalid site id/,
  );
});

test('rejects unsafe pasted HTML storage paths', () => {
  assert.throws(
    () => webpageStorageKey('example-com', '../secret'),
    /Invalid page path/,
  );
});
