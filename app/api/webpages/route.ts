import { webpageStorageKey, WebpageStorageKeyError } from "@/core/frame/pastedHtml";
import { syncSessionFromRequest } from "@/core/persistence/syncIdentity";
import {
  findSyncStateRow,
  readSyncStreamState,
} from "@/core/persistence/syncServerState";
import { getEnv } from "@/core/utils/env";

export const runtime = "edge";

type PastedHtmlRequest = {
  readonly site: string;
  readonly path?: string;
  readonly html: string;
};

class PastedHtmlRequestError extends Error {
  public constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = await readPastedHtmlRequest(request);
    const key = webpageStorageKey(input.site, input.path);
    const env = getEnv();
    const state = await readSyncStreamState(syncSessionFromRequest(request));
    const website = findSyncStateRow(state, "websites", "id", input.site);

    if (!website) {
      throw new PastedHtmlRequestError(`Unknown site: ${input.site}`, 404);
    }

    await env.WEBPAGES_BUCKET.put(key, input.html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
    });

    return Response.json(
      { ok: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function readPastedHtmlRequest(request: Request): Promise<PastedHtmlRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new PastedHtmlRequestError("Paste HTML before saving.");
  }

  if (body === null || typeof body !== "object") {
    throw new PastedHtmlRequestError("Paste HTML before saving.");
  }

  const record = body as Record<string, unknown>;
  if (typeof record.site !== "string" || record.site.trim() === "") {
    throw new PastedHtmlRequestError("Missing site id.");
  }

  if (record.path !== undefined && typeof record.path !== "string") {
    throw new PastedHtmlRequestError("Invalid page path.");
  }

  if (typeof record.html !== "string" || record.html.trim() === "") {
    throw new PastedHtmlRequestError("Paste HTML before saving.");
  }

  return {
    site: record.site,
    path: record.path,
    html: record.html.trim(),
  };
}

function errorResponse(error: unknown): Response {
  if (error instanceof WebpageStorageKeyError || error instanceof PastedHtmlRequestError) {
    const status = error instanceof PastedHtmlRequestError ? error.status : 400;
    return Response.json(
      { error: error.message },
      {
        status,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  console.error("Failed to save pasted HTML", error);
  return Response.json(
    { error: "Failed to save pasted HTML." },
    {
      status: 500,
      headers: { "cache-control": "no-store" },
    },
  );
}
