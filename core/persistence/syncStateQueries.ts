import type { RecordCursor, RecordDatabase } from "@mintcd/sync-engine/records";
import { model } from "../../sync/model.generated.ts";
import type { Schema } from "../../sync/model.generated.ts";
import type { TableName } from "../../sync/types.ts";
import { retrySyncDatabaseOperation } from "./syncLegacyImport.ts";
import { SYNC_QUERY_PAGE_SIZE } from "./syncQueries.ts";

export type SyncMaterializedState = Partial<Record<TableName, readonly Record<string, unknown>[]>>;

/** Read every collection at one confirmed revision, following bounded cursors. */
export async function readSyncDatabaseState(database: RecordDatabase<Schema>): Promise<SyncMaterializedState> {
  const result = await retrySyncDatabaseOperation(() => database.transaction("readonly", async transaction => {
    const state: SyncMaterializedState = {};
    for (const collection of Object.keys(model.schema.collections) as TableName[]) {
      const rows: Record<string, unknown>[] = [];
      let cursor: RecordCursor | undefined;
      do {
        const page = await transaction.query("confirmed", {
          collection,
          limit: SYNC_QUERY_PAGE_SIZE,
          ...(cursor === undefined ? {} : { cursor }),
        });
        rows.push(...page.rows);
        cursor = page.nextCursor;
      } while (cursor !== undefined);
      state[collection] = rows;
    }
    return state;
  }));
  return result.value;
}
