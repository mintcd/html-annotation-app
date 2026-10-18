import { env } from "cloudflare:workers";
import { createCrudPolicy } from "@mintcd/sync-engine/records";
import type { SyncRequestScope } from "@mintcd/sync-engine/transport/http-server";
import { resolveSyncRequestContext } from "../core/persistence/syncServerAuth";
import { ensureLegacySyncImported } from "../core/persistence/syncLegacyImport";
import { model } from "./model.generated";

export async function resolveContext(request: Request, scope: SyncRequestScope) {
  const resolved = resolveSyncRequestContext(request, scope);
  await ensureLegacySyncImported(env.DB, resolved.streamId);
  return resolved;
}

export const policy = createCrudPolicy(model);
