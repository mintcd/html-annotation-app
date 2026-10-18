import assert from 'node:assert/strict';
import test from 'node:test';
import { collectSyncRows, type PagedSyncQuery } from '../core/persistence/syncQueries.ts';
import { createMemoryRecordDatabase } from '@mintcd/sync-engine/adapters/memory';
import { createSyncEngine } from '@mintcd/sync-engine/client';
import { crudCollections, openRecordReplica } from '@mintcd/sync-engine/records';
import { model } from '../sync/model.generated.ts';

test('reads every cursor page beyond the engine defaults and maximum single page', async () => {
  const source = Array.from({ length: 2505 }, (_, index) => ({ id: index }));
  const reads: { offset: number; limit: number }[] = [];
  function query(offset = 0, limit = 100): PagedSyncQuery<{ id: number }, number> {
    return {
      limit: next => query(offset, next),
      cursor: next => query(next, limit),
      async execute() {
        reads.push({ offset, limit });
        const next = offset + limit;
        return { rows: source.slice(offset, next), ...(next < source.length ? { nextCursor: next } : {}) };
      },
    };
  }
  assert.deepEqual(await collectSyncRows(query()), source);
  assert.deepEqual(reads, Array.from({ length: 10 }, (_, index) => ({ offset: index * 256, limit: 256 })));
});

test('keeps following an empty page when storage supplies a continuation cursor', async () => {
  const query: PagedSyncQuery<string, number> = {
    limit() { return this; },
    cursor() { return { ...this, async execute() { return { rows: ['last'] }; } }; },
    async execute() { return { rows: [], nextCursor: 1 }; },
  };
  assert.deepEqual(await collectSyncRows(query), ['last']);
});

test('reports a later page failure instead of presenting an incomplete collection', async () => {
  const query: PagedSyncQuery<string, number> = {
    limit() { return this; },
    cursor() { return { ...this, async execute() { throw new Error('database closed'); } }; },
    async execute() { return { rows: ['first'], nextCursor: 1 }; },
  };
  await assert.rejects(collectSyncRows(query), /database closed/);
});

test('uses the real generated model and replica scan budget to read more than 1000 pages', async () => {
  const timestamp = '2026-10-18T12:00:00.000Z';
  const pages = Array.from({ length: 1205 }, (_, index) => ({
    id: `page-${String(index).padStart(4, '0')}`,
    url: `https://example.test/${index}`,
    title: `Page ${index}`,
    number_of_annotations: 0,
    number_of_scripts: 0,
    created_at: timestamp,
    updated_at: timestamp,
  }));
  const database = createMemoryRecordDatabase({
    streamId: 'user:query-test', schema: model.schema,
    initialRows: pages.map(row => ({ type: 'put', collection: 'pages' as const, row })),
  });
  const replica = await openRecordReplica({ database, model, clientId: 'query-client' });
  const engine = await createSyncEngine({
    replica, collections: crudCollections(model),
    transport: { async exchange() { throw new Error('This local query must not contact the server'); } },
  });
  try {
    assert.deepEqual(await collectSyncRows(engine.from('pages')), pages);
    const found = await collectSyncRows(engine.from('pages').where('url', 'eq', 'https://example.test/1204'));
    assert.deepEqual(found, [pages[1204]]);
  } finally {
    await engine.close();
  }
});
