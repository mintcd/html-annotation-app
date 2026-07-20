// ─── Asset Proxy ─────────────────────────────────────────────────────────────
//
// Rewritten frame resources point here as /proxy/{site-slug}/path/to/file.ext.
// Middleware also routes same-origin fallback requests from runtime-generated
// relative URLs to this handler so it can fetch the real upstream content.
//
// Because the browser believes the asset lives under /proxy/{slug}/path/,
// relative imports/url() values inside CSS and scripts keep resolving through
// this same asset proxy path.

import {
  OutboundFetchError,
  fetchOutboundUrl,
  readResponseArrayBuffer,
  readResponseText,
} from "@/core/net/outboundFetch";
import { syncSessionFromRequest } from "@/core/persistence/syncIdentity";
import {
  findSyncStateRow,
  readSyncStreamState,
} from "@/core/persistence/syncServerState";

const PROXY_FETCH_TIMEOUT_MS = 10_000;
const PROXY_MAX_REDIRECTS = 5;
const PROXY_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;


export async function GET(
  request: Request,
  { params }: { params: { site: string; path?: string[] } }
) {
  const reqUrl = new URL(request.url);
  const { site, path } = params;

  // Get origin from slug and build upstream URL
  let siteOrigin: string;
  try {
    const state = await readSyncStreamState(syncSessionFromRequest(request));
    const row = findSyncStateRow<{ origin: string }>(
      state,
      "websites",
      "id",
      site,
    );

    if (!row) {
      return new Response(`Unknown site slug: ${site}`, { status: 404 });
    }
    siteOrigin = row.origin;
  } catch {
    return new Response("Database unavailable", { status: 503 });
  }

  const pathname = path?.length ? "/" + path.join("/") : "/";
  const search = reqUrl.search || "";
  const targetUrl = `${siteOrigin}${pathname}${search}`;

  // ── 3. Fetch upstream ────────────────────────────────────────────────────
  const reqHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  let upstream: Response;
  try {
    const result = await fetchOutboundUrl(targetUrl, {
      method: "GET",
      headers: reqHeaders,
      maxBytes: PROXY_MAX_RESPONSE_BYTES,
      maxRedirects: PROXY_MAX_REDIRECTS,
      timeoutMs: PROXY_FETCH_TIMEOUT_MS,
    });
    upstream = result.response;
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Upstream fetch failed",
      { status: error instanceof OutboundFetchError ? error.status : 502 },
    );
  }

  if (!upstream.ok) {
    return new Response(
      `Upstream fetch failed: ${upstream.status} ${upstream.statusText}`,
      { status: 502 }
    );
  }

  const ct = upstream.headers.get("Content-Type") || "";
  const corsOrigin = request.headers.get("origin") || "*";

  const isScript =
    ct.includes("javascript") ||
    ct.includes("typescript") ||
    ct.includes("ecmascript");
  const isScriptFile =
    pathname.endsWith(".js") ||
    pathname.endsWith(".mjs") ||
    pathname.endsWith(".cjs") ||
    pathname.endsWith(".ts") ||
    pathname.endsWith(".mts") ||
    pathname.endsWith(".jsx") ||
    pathname.endsWith(".tsx");
  const isCss = ct.includes("text/css") || pathname.endsWith(".css");

  // ── 4. Text assets: targeted rewriting ──────────────────────────────────
  if (isScript || isScriptFile || isCss) {
    let text: string;
    try {
      text = await readResponseText(upstream, PROXY_MAX_RESPONSE_BYTES);
    } catch (error) {
      return new Response(
        error instanceof Error ? error.message : "Upstream response failed",
        { status: error instanceof OutboundFetchError ? error.status : 502 },
      );
    }

    if (isScript || isScriptFile) {

      const contentType =
        (pathname.endsWith('.ts') ||
          pathname.endsWith('.mts') ||
          pathname.endsWith('.tsx')) &&
          !ct.includes('text/')
          ? 'application/javascript; charset=utf-8'
          : ct || 'application/javascript; charset=utf-8';

      return new Response(text, {
        status: upstream.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control':
            upstream.headers.get('Cache-Control') ?? 'public, max-age=3600',
          'Access-Control-Allow-Origin': corsOrigin,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }


    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': ct || 'text/css; charset=utf-8',
        'Cache-Control':
          upstream.headers.get('Cache-Control') ?? 'public, max-age=3600',
        'Access-Control-Allow-Origin': corsOrigin,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // ── 5. Binary / other assets - stream through unchanged ─────────────────
  let body: ArrayBuffer;
  try {
    body = await readResponseArrayBuffer(upstream, PROXY_MAX_RESPONSE_BYTES);
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Upstream response failed",
      { status: error instanceof OutboundFetchError ? error.status : 502 },
    );
  }

  const headers = new Headers();
  if (ct) headers.set("Content-Type", ct);
  headers.set("Content-Length", String(body.byteLength));
  headers.set(
    "Cache-Control",
    upstream.headers.get("Cache-Control") ?? "public, max-age=31536000, immutable"
  );
  headers.set("Access-Control-Allow-Origin", corsOrigin);
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
