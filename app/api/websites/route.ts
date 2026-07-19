import { syncSessionFromRequest } from "@/core/persistence/syncIdentity";
import {
  getSyncStateRows,
  readSyncStreamState,
} from "@/core/persistence/syncServerState";

export const runtime = "edge";

type WebsiteRow = Website & Record<string, unknown>;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const session = syncSessionFromRequest(request);
  const state = await readSyncStreamState(session);
  const rows = getSyncStateRows<WebsiteRow>(state, "websites");
  const filtered = id === null
    ? rows
    : rows.filter((row) => String(row.id) === id);

  return Response.json(filtered, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
