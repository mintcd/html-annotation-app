// ─── Asset Proxy ─────────────────────────────────────────────────────────────
//
// This route is never hit directly by the browser. Next.js middleware rewrites
// /{site-slug}/path/to/file.ext -> /proxy/{site-slug}/path/to/file.ext so that
// asset URLs in cloned pages look like  /plato-stanford-edu/scripts/app.js
// while this handler fetches the real upstream content.
//
// Because the browser believes the asset lives at /{slug}/path/, relative
// imports/url() values resolve correctly without any rewriting.
// We only need to rewrite ROOT-RELATIVE paths ( /absolute ) that would
// otherwise resolve against the app's own origin instead of the site's.

import { getEnv } from "@/utils/env";



export async function GET(
  request: Request,
  { params }: { params: { site: string; path?: string[] } }
) {
  const reqUrl = new URL(request.url);
  const { site, path } = params;
  const env = getEnv();

  // Get origin from slug and build upstream URL
  let siteOrigin: string;
  try {
    const row = await env.DB.prepare(
      "SELECT origin FROM websites WHERE id = ?"
    )
      .bind(site)
      .first<{ origin: string }>();

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

  const upstream = await fetch(targetUrl, { method: "GET", headers: reqHeaders, })

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
    let text = await upstream.text();
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
      },
    });
  }

  // ── 5. Binary / other assets - stream through unchanged ─────────────────
  const headers = new Headers();
  if (ct) headers.set("Content-Type", ct);
  headers.set(
    "Cache-Control",
    upstream.headers.get("Cache-Control") ?? "public, max-age=31536000, immutable"
  );
  headers.set("Access-Control-Allow-Origin", corsOrigin);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
