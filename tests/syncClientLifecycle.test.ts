import assert from 'node:assert/strict';
import test from 'node:test';
import { createSyncClientLifecycle } from '../core/persistence/syncClientLifecycle.ts';

const alice = { accountId: 'alice', streamId: 'user:alice' };
const bob = { accountId: 'bob', streamId: 'user:bob' };

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>(complete => { resolve = complete; });
  return { promise, resolve };
}

test('drains a cancelled opening before opening a Strict Mode replacement', async () => {
  const events: string[] = [];
  const opening = deferred<void>();
  const closing = deferred<void>();
  let firstActive = true;
  let opens = 0;
  const lifecycle = createSyncClientLifecycle({
    async create() {
      const number = ++opens;
      events.push(`open ${number}`);
      if (number === 1) await opening.promise;
      return { async close() {
        events.push(`closing ${number}`);
        if (number === 1) await closing.promise;
        events.push(`closed ${number}`);
      } };
    },
    async logout() { events.push('logout'); },
  });

  const first = lifecycle.open(alice, true, () => firstActive);
  await Promise.resolve();
  firstActive = false;
  const cleanup = lifecycle.close(undefined);
  const replacement = lifecycle.open(alice, true, () => true);
  opening.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(opens, 1, 'replacement must wait for native close/drain');
  closing.resolve();
  assert.equal(await first, undefined);
  await cleanup;
  const current = await replacement;
  assert.deepEqual(events, ['open 1', 'closing 1', 'closed 1', 'open 2']);
  await lifecycle.close(current);
});

test('closes and logs out the old account before initializing another account', async () => {
  const events: string[] = [];
  const lifecycle = createSyncClientLifecycle({
    async create(identity, initialize) {
      events.push(`open ${identity.accountId} ${initialize}`);
      return { async close() { events.push(`close ${identity.accountId}`); } };
    },
    async logout() { events.push('logout'); },
  });
  const first = await lifecycle.open(alice, true, () => true);
  const second = await lifecycle.open(bob, true, () => true);
  await lifecycle.close(first); // Late cleanup must not close the new account.
  assert.deepEqual(events, ['open alice true', 'close alice', 'logout', 'open bob true']);
  await lifecycle.close(second);
});

test('offline recovery never initializes or logs out a retained replica', async () => {
  const events: string[] = [];
  const lifecycle = createSyncClientLifecycle({
    previousIdentity: alice,
    async create(identity, initialize) {
      events.push(`open ${identity.accountId} ${initialize}`);
      return { async close() { events.push('close'); } };
    },
    async logout() { events.push('logout'); },
  });
  const client = await lifecycle.open(alice, false, () => true);
  await lifecycle.close(client);
  assert.deepEqual(events, ['open alice false', 'close']);
  await lifecycle.open(undefined, false, () => true);
  assert.deepEqual(events, ['open alice false', 'close']);
  await lifecycle.open(undefined, true, () => true);
  assert.equal(events.at(-1), 'logout');
});

test('remembered accounts are disabled before verified account switches after reload', async () => {
  const events: string[] = [];
  const lifecycle = createSyncClientLifecycle({
    previousIdentity: alice,
    async create(identity) {
      events.push(`open ${identity.accountId}`);
      return { async close() {} };
    },
    async logout() { events.push('logout'); },
  });
  await lifecycle.open(bob, true, () => true);
  assert.deepEqual(events, ['logout', 'open bob']);
});

test('an opening failure does not prevent a later authenticated retry', async () => {
  let attempts = 0;
  const lifecycle = createSyncClientLifecycle({
    async create() {
      if (++attempts === 1) throw new Error('storage temporarily unavailable');
      return { async close() {} };
    },
    async logout() {},
  });
  await assert.rejects(lifecycle.open(alice, true, () => true), /storage temporarily unavailable/);
  const client = await lifecycle.open(alice, true, () => true);
  assert.ok(client);
  await lifecycle.close(client);
});
