import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeWebpageStorageSearch,
  scopedWebpageStorageKey,
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

test('builds user-scoped pasted HTML storage keys', () => {
  assert.equal(
    scopedWebpageStorageKey('User_1', 'example-com', undefined),
    'users/user_1/webpages/example-com/__root__/query-none',
  );
  assert.equal(
    scopedWebpageStorageKey('user-1', 'example-com', ['article', '10.1007']),
    'users/user-1/webpages/example-com/article/10.1007/query-none',
  );
});

test('includes normalized page search in scoped pasted HTML storage keys', () => {
  const first = scopedWebpageStorageKey('user-1', 'example-com', 'article', '?a=1');
  const second = scopedWebpageStorageKey('user-1', 'example-com', 'article', 'a=2');

  assert.match(first, /^users\/user-1\/webpages\/example-com\/article\/query-[0-9a-f]{16}$/);
  assert.equal(
    first,
    scopedWebpageStorageKey('user-1', 'example-com', 'article', 'a=1'),
  );
  assert.notEqual(first, second);
});

test('normalizes empty pasted HTML storage searches', () => {
  assert.equal(normalizeWebpageStorageSearch(undefined), '');
  assert.equal(normalizeWebpageStorageSearch('?'), '');
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

test('rejects unsafe pasted HTML storage owners and searches', () => {
  assert.throws(
    () => scopedWebpageStorageKey('user:1', 'example-com', 'article'),
    /Invalid storage owner id/,
  );
  assert.throws(
    () => normalizeWebpageStorageSearch('a=\u0000'),
    /Invalid page search/,
  );
});
