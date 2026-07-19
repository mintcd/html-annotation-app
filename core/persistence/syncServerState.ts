import { getEnv } from "../utils/env";
import type { SyncSession } from "./syncIdentity";

const SYNC_TABLE_PREFIX = "html_annotation_sync";

type SyncStateRow = {
  readonly materialized_state_json: string;
};

type SyncMaterializedState = {
  readonly tables?: Record<string, Record<string, Record<string, unknown>>>;
};

export async function readSyncStreamState(
  session: SyncSession,
): Promise<SyncMaterializedState | null> {
  if (!session.authenticated) {
    return null;
  }

  const row = await getEnv().DB.prepare(
    `SELECT materialized_state_json
     FROM ${SYNC_TABLE_PREFIX}_streams
     WHERE stream_id = ?`,
  )
    .bind(session.streamId)
    .first<SyncStateRow>();

  if (row === null) {
    return null;
  }

  try {
    return JSON.parse(row.materialized_state_json) as SyncMaterializedState;
  } catch (error) {
    console.error("Failed to parse sync stream materialized state", error);
    return null;
  }
}

export function getSyncStateRows<Row extends Record<string, unknown>>(
  state: SyncMaterializedState | null,
  tableName: string,
): Row[] {
  const table = state?.tables?.[tableName];
  if (table === undefined) {
    return [];
  }
  return Object.values(table) as Row[];
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
