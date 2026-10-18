import { env } from "cloudflare:workers";
import type { TableName } from "../../sync/types";
import { ensureLegacySyncImported } from "./syncLegacyImport";
import { readSyncDatabaseState } from "./syncStateQueries";
import type { SyncMaterializedState } from "./syncStateQueries";
import type { SyncSession } from "./syncIdentity";

export async function readSyncStreamState(
  session: SyncSession,
): Promise<SyncMaterializedState | null> {
  if (!session.authenticated) {
    return null;
  }

  const database = await ensureLegacySyncImported(env.DB, session.streamId);
  return readSyncDatabaseState(database);
}

export function getSyncStateRows<Row extends Record<string, unknown>>(
  state: SyncMaterializedState | null,
  tableName: string,
): Row[] {
  return [...(state?.[tableName as TableName] ?? [])] as Row[];
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
