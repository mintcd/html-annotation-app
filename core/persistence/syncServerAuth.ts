import { SyncHttpError } from "@mintcd/sync-engine/transport/http-server";
import type {
  ResolvedSyncContext,
  SyncRequestScope,
} from "@mintcd/sync-engine/transport/http-server";
import { syncSessionFromHeaderValues } from "./syncIdentity.ts";

export interface SyncRequestContext {
  readonly userId: string;
}

/** Authorize the cookie session before opening a D1 authority stream. */
export function resolveSyncRequestContext(
  request: Request,
  scope: SyncRequestScope,
): ResolvedSyncContext<SyncRequestContext> {
  let session;
  try {
    // The public identity header is not an authentication credential.
    session = syncSessionFromHeaderValues(null, request.headers.get("cookie"));
  } catch {
    throw new SyncHttpError(401, "unauthenticated", "Sign in to synchronize.");
  }
  if (!session.authenticated) {
    throw new SyncHttpError(401, "unauthenticated", "Sign in to synchronize.");
  }
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new SyncHttpError(403, "origin-denied", "Sync request origin denied.");
  }
  if (scope.streamId !== session.streamId) {
    throw new SyncHttpError(403, "stream-denied", "Sync stream denied.");
  }
  return { streamId: session.streamId, context: { userId: session.userId } };
}
