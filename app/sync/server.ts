import {
  createD1RowSyncAuthority,
  createRowSyncRouteServer,
  defineNextSyncServer,
} from "@mintcd/sync-engine/next";
import type {
  D1DatabaseLike,
  SyncRouteAuthority,
} from "@mintcd/sync-engine/next";
import type {
  RowOperation,
  RowRejection,
} from "@mintcd/sync-engine/client";
import { getEnv } from "@/core/utils/env";
import { syncSessionFromRequest } from "@/core/persistence/syncIdentity";
import { replicaSchema } from "./sync.generated";

type RowAuthority = SyncRouteAuthority<
  RowOperation,
  RowOperation,
  RowRejection
>;

const TABLE_PREFIX = "html_annotation_sync";

const authorities = new Map<string, RowAuthority>();

function getDatabase(): D1DatabaseLike {
  const database = getEnv().DB;
  if (
    database === null ||
    typeof database !== "object" ||
    typeof (database as { prepare?: unknown }).prepare !== "function"
  ) {
    throw new Error("Cloudflare D1 binding DB is unavailable");
  }
  return database as D1DatabaseLike;
}

function authorityFor(streamId: string): RowAuthority {
  let authority = authorities.get(streamId);
  if (authority === undefined) {
    authority = createD1RowSyncAuthority({
      database: getDatabase(),
      streamId,
      schema: replicaSchema,
      tablePrefix: TABLE_PREFIX,
      projectRowsToApplicationTables: true,
    });
    authorities.set(streamId, authority);
  }
  return authority;
}

export const syncServer = defineNextSyncServer(
  createRowSyncRouteServer({
    schema: replicaSchema,
    resolveStream({ request }) {
      return syncSessionFromRequest(request).streamId;
    },
    getAuthority({ resolvedStreamId }) {
      return authorityFor(resolvedStreamId);
    },
  }),
);

export default syncServer;
