import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryRecordDatabase } from '@mintcd/sync-engine/adapters/memory';
import { createSyncEngine } from '@mintcd/sync-engine/client';
import { createCrudPolicy, crudCollections, openRecordReplica } from '@mintcd/sync-engine/records';
import { createRecordSyncAuthority } from '@mintcd/sync-engine/server';
import { model } from '../sync/model.generated.ts';
import type { Row } from '../sync/types.ts';

test('independent annotation field patches merge across two offline clients', async () => {
  const original: Row<'annotations'> = {
    id: 'annotation-1', page_id: 'page-1', exact: 'Selected text', prefix: 'Before ', suffix: ' after',
    html: null, color: '#87ceeb', comment: null,
    created_at: '2026-10-18T12:00:00.000Z', updated_at: '2026-10-18T12:00:00.000Z',
  };
  const database = () => createMemoryRecordDatabase({
    streamId: 'user:patch-test', schema: model.schema,
    initialRows: [{ type: 'put', collection: 'annotations', row: original }],
  });
  const authority = createRecordSyncAuthority({ database: database(), model, policy: createCrudPolicy(model) });
  async function client(clientId: string) {
    const replica = await openRecordReplica({ database: database(), clientId, model });
    return createSyncEngine({
      replica, collections: crudCollections(model),
      transport: { exchange: request => authority.synchronize(request, undefined) },
    });
  }
  const first = await client('first');
  const second = await client('second');
  try {
    await first.from('annotations').update(['annotation-1'], { comment: 'An offline comment' });
    await second.from('annotations').update(['annotation-1'], { color: '#90ee90' });
    await first.sync();
    await second.sync();
    await first.sync();
    const { row } = await first.from('annotations').get(['annotation-1']);
    assert.deepEqual(row, { ...original, color: '#90ee90', comment: 'An offline comment' });
    assert.deepEqual((await second.from('annotations').get(['annotation-1'])).row, row);
  } finally {
    await first.close();
    await second.close();
  }
});
