import {
  getD1RowSyncStateRows,
  readD1RowSyncState,
  type D1DatabaseLike,
} from "@mintcd/sync-engine/next";
import type { ReplicaDatabaseState } from "@mintcd/sync-engine/client";
import {
  replicaSchema,
  type TableName,
} from "@/app/sync/sync.generated";
import { getEnv } from "../utils/env";
import type { SyncSession } from "./syncIdentity";

const SYNC_TABLE_PREFIX = "html_annotation_sync";

type SyncMaterializedState = ReplicaDatabaseState;

export async function readSyncStreamState(
  session: SyncSession,
): Promise<SyncMaterializedState | null> {
  if (!session.authenticated) {
    return null;
  }

  return readD1RowSyncState({
    database: getEnv().DB as unknown as D1DatabaseLike,
    streamId: session.streamId,
    schema: replicaSchema,
    tablePrefix: SYNC_TABLE_PREFIX,
  });
}

export function getSyncStateRows<Row extends Record<string, unknown>>(
  state: SyncMaterializedState | null,
  tableName: string,
): Row[] {
  return [
    ...getD1RowSyncStateRows(
      replicaSchema,
      state,
      tableName as TableName,
    ),
  ] as unknown as Row[];
}

export function findSyncStateRow<Row extends Record<string, unknown>>(
  state: SyncMaterializedState | null,
  tableName: string,
  column: string,
  value: unknown,
): Row | null {
  return getSyncStateRows<Row>(state, tableName).find((row) =>
    String(row[column]) === String(value),
  ) ?? null;
}
