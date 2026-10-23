import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createIntentHash } from "@mintcd/sync-engine";
import { createD1RecordMigration, openD1RecordDatabase } from "@mintcd/sync-engine/adapters/d1";
import { createCrudPolicy } from "@mintcd/sync-engine/records";
import { createRecordSyncAuthority } from "@mintcd/sync-engine/server";
import { SyncHttpError } from "@mintcd/sync-engine/transport/http-server";
import { ensureLegacySyncImported } from "../core/persistence/syncLegacyImport.ts";
import { readSyncDatabaseState } from "../core/persistence/syncStateQueries.ts";
import { model } from "../sync/model.generated.ts";
import { collections, tablePrefix } from "../sync/d1.generated.ts";

type LegacyOperation = { type: "putRow"; table: "websites"; row: ReturnType<typeof website> }
  | { type: "deleteRow"; table: "websites"; key: { id: string } };

function website(id: string, title: string) {
  return { id, title, origin: `https://${id}.example`, created_at: "2026-01-01", updated_at: "2026-01-01" };
}

async function fixture(t: TestContext) {
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } };",
    d1Databases: ["DB"], compatibilityDate: "2026-07-22", cf: false, host: "127.0.0.1",
  }));
  t.after(() => runtime.dispose());
  const database = await runtime.getD1Database("DB");
  await database.exec(createD1RecordMigration({ schema: model.schema, collections, tablePrefix }));
  await database.exec("CREATE TABLE html_annotation_sync_streams (stream_id TEXT PRIMARY KEY, head_sequence INTEGER NOT NULL);\nCREATE TABLE html_annotation_sync_log_entries (stream_id TEXT NOT NULL, sequence INTEGER NOT NULL, operation_json TEXT NOT NULL, PRIMARY KEY (stream_id, sequence));\nCREATE TABLE websites (id TEXT PRIMARY KEY, title TEXT);\nINSERT INTO websites VALUES ('unscoped', 'Do not import');");
  async function seed(streamId: string, operations: LegacyOperation[]) {
    await database.batch([
      database.prepare("INSERT INTO html_annotation_sync_streams VALUES (?, ?)").bind(streamId, operations.length),
      ...operations.map((operation, index) => database.prepare("INSERT INTO html_annotation_sync_log_entries VALUES (?, ?, ?)").bind(streamId, index + 1, JSON.stringify(operation))),
    ]);
  }
  return { database, seed };
}

test("legacy canonical replay preserves replacements, deletions and stream isolation for fresh clients", { timeout: 60_000 }, async t => {
  const { database, seed } = await fixture(t);
  await seed("user:alice", [
    { type: "putRow", table: "websites", row: website("shared", "First") },
    { type: "putRow", table: "websites", row: website("shared", "Updated") },
    { type: "putRow", table: "websites", row: website("deleted", "Remove me") },
    { type: "deleteRow", table: "websites", key: { id: "deleted" } },
  ]);
  await seed("user:bob", [{ type: "putRow", table: "websites", row: website("shared", "Bob") }]);
  const alice = await ensureLegacySyncImported(database, "user:alice");
  const bob = await ensureLegacySyncImported(database, "user:bob");
  const aliceRows = await alice.transaction("readonly", transaction => transaction.query("confirmed", { collection: "websites", limit: 20 }));
  assert.deepEqual(aliceRows.value.rows, [website("shared", "Updated")]);
  const bobRow = await bob.transaction("readonly", transaction => transaction.get("confirmed", "websites", ["shared"]));
  assert.equal(bobRow.value?.title, "Bob");
  const authority = createRecordSyncAuthority({ database: alice, model, policy: createCrudPolicy(model) });
  const freshPull = await authority.synchronize({ protocolVersion: 1, contractVersion: model.contractVersion, streamId: alice.streamId, baseSequence: 0, maximumEntries: 20, proposals: [] }, undefined);
  assert.equal(freshPull.headSequence, 4);
  assert.equal(freshPull.entries.length, 4, "imported rows must have a pullable canonical history");
  assert.equal(freshPull.entries[3]?.operation.type, "delete");
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM websites").first<{ count: number }>())?.count, 1);
  const state = await readSyncDatabaseState(alice);
  assert.deepEqual(state.websites, [website("shared", "Updated")]);
  assert.deepEqual(Object.keys(state).sort(), Object.keys(model.schema.collections).sort());

  // Genesis is confined to this query fixture. Production imports above use
  // canonical proposals so fresh clients can receive all imported operations.
  const paginated = await openD1RecordDatabase({
    database, streamId: "query-pagination", model, collections, tablePrefix,
    initialRows: Array.from({ length: 300 }, (_, index) => ({
      type: "put" as const, collection: "websites" as const, row: website(`query-${index}`, `Query ${index}`),
    })),
  });
  const manyRows = await readSyncDatabaseState(paginated);
  assert.equal(manyRows.websites?.length, 300, "server reads must follow the 256-row cursor without truncation");
  assert.equal(new Set(manyRows.websites?.map(row => row.id)).size, 300);
});

test("concurrent imports and replay after a lost progress marker keep one canonical identity per old operation", { timeout: 30_000 }, async t => {
  const { database, seed } = await fixture(t);
  await seed("user:alice", [{ type: "putRow", table: "websites", row: website("site", "Imported") }]);
  const [records] = await Promise.all([
    ensureLegacySyncImported(database, "user:alice"),
    ensureLegacySyncImported(database, "user:alice"),
  ]);
  const authority = createRecordSyncAuthority({ database: records, model, policy: createCrudPolicy(model) });
  const intent = model.intent.decode({ type: "update", collection: "websites", key: ["site"], changes: { title: "Edited after import" } });
  await authority.synchronize({
    protocolVersion: 1, contractVersion: model.contractVersion, streamId: records.streamId, baseSequence: 1, maximumEntries: 1,
    proposals: [{ operationId: "new-edit", clientId: "browser", clientSequence: 1, intentHash: await createIntentHash(model.intent.encode(intent)), intent }],
  }, undefined);
  // Losing progress after the canonical commit simulates an interrupted request.
  await records.transaction("readwrite", transaction => transaction.deleteInternal("meta", ["html-annotation-legacy-import"]));
  await ensureLegacySyncImported(database, "user:alice");
  await ensureLegacySyncImported(database, "user:alice");
  const canonical = await database.prepare("SELECT COUNT(*) AS count FROM se_html_annotation_canonical WHERE stream_id = ?").bind("user:alice").first<{ count: number }>();
  assert.equal(canonical?.count, 2);
  const receipts = await database.prepare("SELECT COUNT(*) AS count FROM se_html_annotation_decisions WHERE stream_id = ?").bind("user:alice").first<{ count: number }>();
  assert.equal(receipts?.count, 2);
  const edited = await records.transaction("readonly", transaction => transaction.get("confirmed", "websites", ["site"]));
  assert.equal(edited.value?.title, "Edited after import", "duplicate import receipts must not overwrite later user edits");
});

test("large legacy streams resume across bounded requests without skipping records", { timeout: 90_000 }, async t => {
  const { database, seed } = await fixture(t);
  await seed("user:alice", Array.from({ length: 30 }, (_, index) => ({ type: "putRow", table: "websites", row: website(`site-${index}`, `Title ${index}`) })));
  await assert.rejects(ensureLegacySyncImported(database, "user:alice"), error => error instanceof SyncHttpError && error.status === 503 && error.code === "legacy-import-pending");
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM se_html_annotation_canonical").first<{ count: number }>())?.count, 25);
  // A final legacy writer can append while the first bounded request is active.
  // Once it stops, the next request must continue from the enlarged source head.
  await database.batch([
    database.prepare("INSERT INTO html_annotation_sync_log_entries VALUES (?, ?, ?)").bind("user:alice", 31, JSON.stringify({ type: "putRow", table: "websites", row: website("last-legacy-write", "Final") })),
    database.prepare("UPDATE html_annotation_sync_streams SET head_sequence = 31 WHERE stream_id = ?").bind("user:alice"),
  ]);
  const records = await ensureLegacySyncImported(database, "user:alice");
  const rows = await records.transaction("readonly", transaction => transaction.query("confirmed", { collection: "websites", limit: 50 }));
  assert.equal(rows.value.rows.length, 31);
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM se_html_annotation_canonical").first<{ count: number }>())?.count, 31);
});

test("a gap in legacy history fails before importing that page and never marks the stream complete", { timeout: 30_000 }, async t => {
  const { database, seed } = await fixture(t);
  await seed("user:alice", [
    { type: "putRow", table: "websites", row: website("first", "First") },
    { type: "putRow", table: "websites", row: website("missing", "Missing") },
    { type: "putRow", table: "websites", row: website("last", "Last") },
  ]);
  await database.prepare("DELETE FROM html_annotation_sync_log_entries WHERE stream_id = ? AND sequence = 2").bind("user:alice").run();
  await assert.rejects(ensureLegacySyncImported(database, "user:alice"), /history is incomplete/);
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM se_html_annotation_canonical").first<{ count: number }>())?.count, 0);
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM se_html_annotation_meta").first<{ count: number }>())?.count, 0);
});
