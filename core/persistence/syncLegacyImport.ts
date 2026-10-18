import { createIntentHash, SyncError } from "@mintcd/sync-engine";
import type { Proposal } from "@mintcd/sync-engine";
import { openD1RecordDatabase } from "@mintcd/sync-engine/adapters/d1";
import type { D1Binding } from "@mintcd/sync-engine/adapters/d1";
import type {
  CrudIntent,
  RecordDatabase,
  RecordDecisionPolicy,
} from "@mintcd/sync-engine/records";
import { createRecordSyncAuthority } from "@mintcd/sync-engine/server";
import { SyncHttpError } from "@mintcd/sync-engine/transport/http-server";
import { collections, tablePrefix } from "../../sync/d1.generated.ts";
import { model } from "../../sync/model.generated.ts";
import type { Schema } from "../../sync/model.generated.ts";

type Intent = CrudIntent<typeof model.definition>;
type ImportMarker = {
  version: 1;
  sourceHead: number;
  throughSequence: number;
  complete: boolean;
};
type LegacyEntry = { sequence: number; operation_json: string };

const markerKey = ["html-annotation-legacy-import"];
const batchSize = 8;
const maximumOperationsPerRequest = 25;

export async function retrySyncDatabaseOperation<Value>(run: () => Promise<Value>): Promise<Value> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof SyncError) || error.code !== "commit-conflict" || attempt >= 3) throw error;
    }
  }
}

function validSequence(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

async function readMarker(database: RecordDatabase<Schema>): Promise<ImportMarker | undefined> {
  const result = await retrySyncDatabaseOperation(() => database.transaction("readonly", transaction => transaction.getInternal<ImportMarker>("meta", markerKey)));
  const marker = result.value;
  if (marker !== undefined && (
    marker.version !== 1 || !validSequence(marker.sourceHead) || !validSequence(marker.throughSequence) ||
    marker.throughSequence > marker.sourceHead || marker.complete !== (marker.throughSequence === marker.sourceHead)
  )) {
    throw new SyncError("corrupt-state", "Invalid legacy import progress.");
  }
  return marker;
}

async function readLegacyHead(database: D1Binding, streamId: string): Promise<number> {
  const tables = await database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind("html_annotation_sync_streams").all<{ name: string }>();
  if (!tables.success) throw new SyncError("corrupt-state", "Failed to inspect legacy sync storage.");
  if (tables.results.length === 0) return 0;
  const streams = await database.prepare("SELECT head_sequence FROM html_annotation_sync_streams WHERE stream_id = ? LIMIT 1")
    .bind(streamId).all<{ head_sequence: number }>();
  if (!streams.success) throw new SyncError("corrupt-state", "Failed to read the legacy sync stream.");
  const head = streams.results[0]?.head_sequence ?? 0;
  if (!validSequence(head)) throw new SyncError("corrupt-state", "Invalid legacy sync stream head.");
  return head;
}

/** Decode with the current schema before any canonical write is attempted. */
function legacyIntent(entry: LegacyEntry): Intent {
  const decoded: unknown = JSON.parse(entry.operation_json);
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new SyncError("corrupt-state", "Invalid legacy row operation.");
  }
  const operation = decoded as Record<string, unknown>;
  const collection = operation.table;
  if (typeof collection !== "string" || !Object.hasOwn(model.definition.collections, collection)) {
    throw new SyncError("corrupt-state", "Unknown legacy collection.");
  }
  if (operation.type === "putRow") {
    return model.intent.decode({ type: "insert", collection, row: operation.row });
  }
  if (operation.type === "deleteRow" && operation.key !== null && typeof operation.key === "object" && !Array.isArray(operation.key)) {
    const key = operation.key as Record<string, unknown>;
    const definition = model.definition.collections[collection as keyof typeof model.definition.collections];
    return model.intent.decode({ type: "delete", collection, key: definition.primaryKey.map(field => key[field]) });
  }
  throw new SyncError("corrupt-state", "Unsupported legacy row operation.");
}

// Only the migration helper can use this policy. Normal requests keep the CRUD
// policy's duplicate-insert checks; legacy putRow also represented replacements.
const importPolicy: RecordDecisionPolicy<Schema, Intent, ReturnType<typeof model.operation.decode>, ReturnType<typeof model.rejection.decode>> = (_view, proposal) => {
  const intent = proposal.intent;
  const operation = intent.type === "insert"
    ? model.operation.decode({ type: "put", collection: intent.collection, row: intent.row })
    : intent.type === "delete"
      ? model.operation.decode({ type: "delete", collection: intent.collection, key: intent.key })
      : undefined;
  if (operation === undefined) throw new SyncError("invalid-input", "Unsupported import intent.");
  return { status: "accepted", operation };
};

/**
 * Replay the old stream's confirmed log through normal canonical commits.
 * Stable operation identities make overlapping requests and interrupted imports
 * safe. Shared application tables have no owner and are never used as a source.
 */
export async function importLegacySyncStream(
  source: D1Binding,
  target: RecordDatabase<Schema>,
): Promise<void> {
  let marker = await readMarker(target);
  if (marker?.complete) return;
  const sourceHead = await readLegacyHead(source, target.streamId);
  if (marker !== undefined && marker.sourceHead > sourceHead) {
    throw new SyncError("corrupt-state", "Legacy sync history regressed during import.");
  }
  marker ??= { version: 1, sourceHead, throughSequence: 0, complete: sourceHead === 0 };
  marker = { ...marker, sourceHead, complete: marker.throughSequence === sourceHead };
  const authority = createRecordSyncAuthority({ database: target, model, policy: importPolicy });
  let processed = 0;
  while (marker.throughSequence < sourceHead && processed < maximumOperationsPerRequest) {
    const start: number = marker.throughSequence;
    const limit = Math.min(batchSize, maximumOperationsPerRequest - processed);
    const page: { success: boolean; results: LegacyEntry[] } = await source.prepare("SELECT sequence, operation_json FROM html_annotation_sync_log_entries WHERE stream_id = ? AND sequence > ? AND sequence <= ? ORDER BY sequence LIMIT ?")
      .bind(target.streamId, start, sourceHead, limit).all<LegacyEntry>();
    if (!page.success || page.results.length === 0 || page.results.some((entry, index) => entry.sequence !== start + index + 1)) {
      throw new SyncError("corrupt-state", "Legacy sync history is incomplete.");
    }
    const proposals: Proposal<Intent>[] = await Promise.all(page.results.map(async entry => {
      const intent = legacyIntent(entry);
      return { operationId: `legacy:${entry.sequence}`, clientId: "legacy-import", clientSequence: entry.sequence, intentHash: await createIntentHash(model.intent.encode(intent)), intent };
    }));
    const response = await authority.synchronize({ protocolVersion: 1, contractVersion: model.contractVersion, streamId: target.streamId, baseSequence: 0, maximumEntries: 1, proposals }, undefined);
    if (response.decisions.length !== proposals.length || response.decisions.some(decision => decision.status !== "accepted")) {
      throw new SyncError("corrupt-state", "A legacy canonical operation was not accepted.");
    }
    const throughSequence: number = page.results[page.results.length - 1]!.sequence;
    if (throughSequence === sourceHead) {
      const latestHead = await readLegacyHead(source, target.streamId);
      if (latestHead < sourceHead) throw new SyncError("corrupt-state", "Legacy sync history regressed during import.");
      if (latestHead > sourceHead) {
        await storeMarker(target, { version: 1, sourceHead: latestHead, throughSequence, complete: false });
        throw new SyncHttpError(503, "legacy-import-pending", "Stop legacy sync writers, then retry the data upgrade.", { retryAfterMs: 1000 });
      }
    }
    marker = { version: 1, sourceHead, throughSequence, complete: throughSequence === sourceHead };
    await storeMarker(target, marker);
    processed += page.results.length;
  }
  if (sourceHead === 0) await storeMarker(target, marker);
  if (!(await readMarker(target))?.complete) {
    throw new SyncHttpError(503, "legacy-import-pending", "Existing data is being upgraded. Retry synchronization.", { retryAfterMs: 1000 });
  }
}

async function storeMarker(database: RecordDatabase<Schema>, marker: ImportMarker): Promise<void> {
  await retrySyncDatabaseOperation(() => database.transaction("readwrite", async transaction => {
    const current = await transaction.getInternal<ImportMarker>("meta", markerKey);
    const sourceHead = Math.max(current?.sourceHead ?? 0, marker.sourceHead);
    const throughSequence = Math.max(current?.throughSequence ?? 0, marker.throughSequence);
    if (current === undefined || current.sourceHead !== sourceHead || current.throughSequence !== throughSequence) {
      await transaction.putInternal("meta", markerKey, {
        version: 1, sourceHead, throughSequence, complete: throughSequence === sourceHead,
      });
    }
  }));
}

export async function ensureLegacySyncImported(database: D1Binding, streamId: string) {
  const records = await openD1RecordDatabase({ database, streamId, model, collections, tablePrefix });
  await importLegacySyncStream(database, records);
  return records;
}
