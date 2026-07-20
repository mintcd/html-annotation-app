// ─── Framed Page Proxy ───────────────────────────────────────────────────────
//
// Serves a fully-rewritten HTML page so it can be loaded inside a same-origin
// <iframe>. Same-origin resource URLs are rewritten to app-origin
// /proxy/{slug}/... URLs so source <base> tags cannot rebase them upstream.
// Scripts execute natively in the iframe's own window.
//
// Because the iframe shares our origin, the parent app has full
// iframe.contentDocument access for highlight injection and range matching.

import * as cheerio from 'cheerio';
import {
  OutboundFetchError,
  fetchOutboundUrl,
  readResponseText,
} from '@/core/net/outboundFetch';
import { getEnv } from '@/core/utils/env';
import { stripFrameCacheScopeFromSearch } from '@/core/frame/cacheScope';
import { scopedWebpageStorageKey } from '@/core/frame/pastedHtml';
import {
  isSameOriginUrl,
  resolveUrl,
  rewriteCssUrls,
  rewriteSrcset,
  shouldSkipUrlRewrite,
  toAppScopedBaseUrl,
  toProxyAssetUrl,
} from '@/core/frame/urlRewrite';
import { syncSessionFromRequest } from '@/core/persistence/syncIdentity';
import {
  findSyncStateRow,
  readSyncStreamState,
} from '@/core/persistence/syncServerState';

const BLOCKED_SCRIPT_HOSTS = [
  'googletagmanager.com', 'google-analytics.com', 'analytics.google.com',
  'hotjar.com', 'static.hotjar.com', 'script.hotjar.com',
  'doubleclick.net', 'googlesyndication.com', 'adservice.google.com',
  'connect.facebook.net', 'sc-static.net',
  'cdn.cookielaw.org', 'cdn.onetrust.com', 'onetrust.com',
  'cookiebot.com', 'usercentrics.eu', 'trustarc.com',
];
const FRAME_FETCH_TIMEOUT_MS = 10_000;
const FRAME_MAX_REDIRECTS = 5;
const FRAME_MAX_HTML_BYTES = 5 * 1024 * 1024;

function isBlocked(src: string): boolean {
  try {
    const h = new URL(src).hostname;
    return BLOCKED_SCRIPT_HOSTS.some(d => h === d || h.endsWith('.' + d));
  } catch { return false; }
}

function isJsonOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { JSON.parse(trimmed); return true; } catch { return false; }
  }
  return false;
}

/**
 * Returns an HTML page that signals an error to the parent Annotator component.
 * The parent detects `<meta name="frame-error">` after iframe load and shows
 * the "Paste HTML" fallback UI.
 */
function frameErrorResponse(message: string): Response {
  const html = `<!doctype html><html><head>
<meta name="frame-error" content=${JSON.stringify(message)}>
</head><body></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // The browser-local cache must never replace a working page with this
      // HTTP-200 fallback document during an explicit refresh.
      'X-Annotation-Frame-Error': '1',
    },
  });
}

function isExecutableScriptType(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  return normalized === ''
    || normalized === 'module'
    || normalized === 'text/javascript'
    || normalized === 'application/javascript'
    || normalized === 'text/ecmascript'
    || normalized === 'application/ecmascript'
    || normalized === 'importmap'
    || normalized === 'speculationrules'
    || normalized.includes('javascript')
    || normalized.endsWith('/ecmascript');
}

function disableStoredHtmlExecution($: cheerio.CheerioAPI): void {
  $('meta[http-equiv="refresh"]').remove();

  $('script').each((_, el) => {
    const type = $(el).attr('type') || '';
    if (!isExecutableScriptType(type)) return;

    const src = $(el).attr('src');
    if (src) $(el).attr('data-annotation-original-src', src);
    $(el)
      .removeAttr('src')
      .attr('type', 'application/x-annotation-disabled-script')
      .text('');
  });

  $('iframe').each((_, el) => {
    $(el).attr('sandbox', '');
    if ($(el).attr('srcdoc')) {
      $(el)
        .attr('data-annotation-original-srcdoc', '')
        .removeAttr('srcdoc');
    }
  });

  $('*').each((_, el) => {
    const attribs = (el as { attribs?: Record<string, string> }).attribs ?? {};
    for (const name of Object.keys(attribs)) {
      if (/^on/i.test(name)) $(el).removeAttr(name);
    }
  });
}

export async function GET(
  request: Request,
  { params }: { params: { site: string; path?: string[] } }
) {
  const { site, path } = params;
  const reqUrl = new URL(request.url);
  const session = syncSessionFromRequest(request);
  const upstreamSearch = stripFrameCacheScopeFromSearch(reqUrl.search);

  const env = getEnv();
  const state = await readSyncStreamState(session);
  const cookieRow = findSyncStateRow<{ cookie: string }>(
    state,
    'site_cookies',
    'site_id',
    site,
  );
  const siteCookie: string | null = cookieRow ? cookieRow.cookie : null;

  // ── 1. Resolve origin ──────────────────────────────────────────────────
  let siteOrigin: string;
  let storedHtml: string | null = null;
  try {

    const row = findSyncStateRow<{ origin: string }>(
      state,
      'websites',
      'id',
      site,
    );
    if (!row) return frameErrorResponse(`Unknown site: ${site}`);
    siteOrigin = row.origin;

    // ── Check R2 bucket for user-pasted HTML ───────────────────────────
    const r2Key = scopedWebpageStorageKey(session.userId, site, path, upstreamSearch);
    const stored = await env.WEBPAGES_BUCKET.get(r2Key);
    if (stored) storedHtml = await stored.text();
  } catch {
    return frameErrorResponse('Database unavailable');
  }

  // ── 2. Fetch upstream HTML ─────────────────────────────────────────────
  const pathname = path?.length ? '/' + path.join('/') : '/';
  const targetUrl = `${siteOrigin}${pathname}${upstreamSearch}`;

  let html: string;
  let finalUrl: string;

  if (storedHtml) {
    // Use the user-pasted HTML from R2 - skip upstream fetch
    html = storedHtml;
    finalUrl = targetUrl;
  } else {
    try {
      // Forward real browser headers so Cloudflare Bot Management doesn't flag
      // the request as bot traffic (it checks UA, sec-ch-ua, Accept-Language etc.)
      const FORWARD_HEADERS = [
        'user-agent', 'accept', 'accept-language', 'accept-encoding',
        'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
        'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
        'upgrade-insecure-requests', 'cache-control', 'pragma',
      ];
      const reqHeaders: Record<string, string> = {};
      for (const h of FORWARD_HEADERS) {
        const v = request.headers.get(h);
        if (v) reqHeaders[h] = v;
      }
      // Override referer/origin to the target site so it looks like direct navigation
      reqHeaders['referer'] = siteOrigin + '/';
      if (siteCookie?.trim()) reqHeaders['cookie'] = siteCookie;

      const { response: upstream, finalUrl: upstreamUrl } = await fetchOutboundUrl(targetUrl, {
        headers: reqHeaders,
        maxBytes: FRAME_MAX_HTML_BYTES,
        maxRedirects: FRAME_MAX_REDIRECTS,
        timeoutMs: FRAME_FETCH_TIMEOUT_MS,
        allowedContentTypes: ['text/html', 'application/xhtml+xml'],
        allowMissingContentType: true,
      });

      if (!upstream.ok) {
        return frameErrorResponse(
          `Source page returned ${upstream.status} ${upstream.statusText || 'Error'}`,
        );
      }

      html = await readResponseText(upstream, FRAME_MAX_HTML_BYTES);
      finalUrl = upstreamUrl.href;
    } catch (e) {
      const message = e instanceof OutboundFetchError || e instanceof Error
        ? e.message
        : String(e);
      return frameErrorResponse(`Fetch error: ${message}`);

    }
  }

  // ── 3. Stored HTML: serve static markup with <base>, skip proxy rewriting ─
  // Assets load directly from the original site in the user's browser.
  // This avoids Akamai/bot-protection blocking our server-side proxy requests.
  if (storedHtml) {
    const $s = cheerio.load(html);
    $s('meta[http-equiv="Content-Security-Policy"]').remove();
    $s('meta[http-equiv="X-Frame-Options"]').remove();
    disableStoredHtmlExecution($s);
    // Remove existing base tag so ours takes precedence
    $s('base').remove();
    // Inject base tag so relative assets still resolve against the source page.
    $s('head').prepend(`<base href=${JSON.stringify(targetUrl)}>`);
    return new Response($s.html(), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'SAMEORIGIN',
        'Set-Cookie': `__proxy_site=${site}; Path=/; SameSite=Lax${reqUrl.protocol === 'https:' ? '; Secure' : ''}`,
      },
    });
  }

  // ── 4. Rewrite URLs (fetched pages) ───────────────────────────────────
  const pageUrl = new URL(finalUrl);
  const $ = cheerio.load(html);
  const baseTagHref = $('base[href]').first().attr('href');
  const base = (baseTagHref ? new URL(baseTagHref, pageUrl) : new URL('.', pageUrl)).href;
  const appOrigin = reqUrl.origin;

  // Remove CSP meta tags so the page can load proxied resources
  $('meta[http-equiv="Content-Security-Policy"]').remove();
  $('meta[http-equiv="X-Frame-Options"]').remove();
  $('base').remove();
  $('head').prepend(`<base href=${JSON.stringify(toAppScopedBaseUrl(site, base, appOrigin))}>`);

  const proxiedFrameResourceUrl = (absolute: string): string => (
    isSameOriginUrl(absolute, pageUrl.origin)
      ? toProxyAssetUrl(site, absolute, appOrigin)
      : absolute
  );
  const rewriteFrameResourceUrl = (raw: string): string => (
    proxiedFrameResourceUrl(resolveUrl(base, raw))
  );

  // Remove resource hints (React 19 hoists <link> elements from iframes too)
  $('link[rel~="preload"], link[rel~="prefetch"], link[rel~="modulepreload"], link[rel~="preconnect"], link[rel~="dns-prefetch"]').remove();

  // Remove blocked third-party scripts
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (isBlocked(resolveUrl(base, src))) $(el).remove();
  });

  // Inject proxy:script-executed signals into inline scripts.
  // External scripts get the signal appended by /proxy/route.ts instead.
  let scriptIndex = 0;
  $('script:not([src])').each((_, el) => {
    const type = $(el).attr('type') || '';
    if (type && type !== 'text/javascript' && type !== 'module' && !type.includes('javascript')) return;
    const content = $(el).text().trim();
    if (!content || isJsonOnly(content)) return;
    const id = `${targetUrl}#script-${scriptIndex++}`;
    $(el).text(`${content}`);
  });

  // Rewrite resource URLs to app-origin proxy URLs. Keeping these absolute
  // prevents source <base> behavior from rebasing /proxy/... back upstream.
  $('[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (shouldSkipUrlRewrite(src)) return;
    $(el).attr('src', rewriteFrameResourceUrl(src));
  });

  $('[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (shouldSkipUrlRewrite(href)) return;
    const rel = $(el).attr('rel') || '';
    // Stylesheet hrefs → proxy if same-origin, leave absolute if external CDN
    // (external font CDNs like fonts.googleapis.com have CORS headers; proxying
    // them strips their hostname and causes a 404, breaking web fonts).
    if (rel.includes('stylesheet') || el.tagName === 'link') {
      $(el).attr('href', rewriteFrameResourceUrl(href));
    }
    // <a href> - rewrite to absolute so relative links don't 404 in our origin,
    // but don't proxy them (navigation is handled by the parent app).
    else if (el.tagName === 'a') {
      $(el).attr('href', resolveUrl(base, href));
    }
  });

  $('[action]').each((_, el) => {
    const action = $(el).attr('action') || '';
    if (shouldSkipUrlRewrite(action)) return;
    $(el).attr('action', resolveUrl(base, action));
  });

  // srcset
  $('[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset') || '';
    $(el).attr('srcset', rewriteSrcset(srcset, rewriteFrameResourceUrl));
  });

  // Inline style url() references
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    $(el).attr('style', rewriteCssUrls(style, base, proxiedFrameResourceUrl));
  });

  $('style').each((_, el) => {
    const style = $(el).html() || '';
    $(el).text(rewriteCssUrls(style, base, proxiedFrameResourceUrl));
  });

  const rewritten = $.html();
  return new Response(rewritten, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // Allow framing from our own origin
      'X-Frame-Options': 'SAMEORIGIN',
      'Set-Cookie': `__proxy_site=${site}; Path=/; SameSite=Lax${reqUrl.protocol === 'https:' ? '; Secure' : ''}`,
    },
  });
}
