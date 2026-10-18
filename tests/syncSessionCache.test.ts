import assert from 'node:assert/strict';
import test from 'node:test';
import { syncSessionForUserId } from '../core/persistence/syncIdentity.ts';
import {
  cacheVerifiedSyncSession, readCachedSyncSession, SYNC_SESSION_CACHE_KEY,
} from '../core/persistence/syncSessionCache.ts';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test('retains verified identity for offline reopen and clears it on verified logout', () => {
  const cache = storage();
  const session = { ...syncSessionForUserId('alice'), username: 'Alice' };
  cacheVerifiedSyncSession(cache, session);
  assert.deepEqual(readCachedSyncSession(cache), session);
  cacheVerifiedSyncSession(cache, syncSessionForUserId(undefined));
  assert.equal(readCachedSyncSession(cache), undefined);
});

test('rebuilds the account stream instead of trusting cached stream metadata', () => {
  const cache = storage();
  cache.setItem(SYNC_SESSION_CACHE_KEY, JSON.stringify({
    userId: 'alice', authenticated: true, streamId: 'user:bob',
  }));
  assert.deepEqual(readCachedSyncSession(cache), syncSessionForUserId('alice'));
  cache.setItem(SYNC_SESSION_CACHE_KEY, 'invalid json');
  assert.equal(readCachedSyncSession(cache), undefined);
});

test('unavailable browser storage does not fail session resolution', () => {
  const unavailable = {
    getItem(): never { throw new Error('denied'); },
    setItem(): never { throw new Error('denied'); },
    removeItem(): never { throw new Error('denied'); },
  };
  assert.equal(readCachedSyncSession(unavailable), undefined);
  assert.doesNotThrow(() => cacheVerifiedSyncSession(unavailable, syncSessionForUserId('alice')));
});
