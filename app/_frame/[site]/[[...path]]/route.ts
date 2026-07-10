// ─── Framed Page Proxy ───────────────────────────────────────────────────────
//
// Serves a fully-rewritten HTML page so it can be loaded inside a same-origin
// <iframe>. Resource URLs are rewritten to /_proxy/{slug}/… so assets load
// correctly. Scripts execute natively in the iframe's own window.
//
// Because the iframe shares our origin, the parent app has full
// iframe.contentDocument access for highlight injection and range matching.

import * as cheerio from 'cheerio';
import { getEnv } from '@/utils/env';

const BLOCKED_SCRIPT_HOSTS = [
  'googletagmanager.com', 'google-analytics.com', 'analytics.google.com',
  'hotjar.com', 'static.hotjar.com', 'script.hotjar.com',
  'doubleclick.net', 'googlesyndication.com', 'adservice.google.com',
  'connect.facebook.net', 'sc-static.net',
  'cdn.cookielaw.org', 'cdn.onetrust.com', 'onetrust.com',
  'cookiebot.com', 'usercentrics.eu', 'trustarc.com',
];

function isBlocked(src: string): boolean {
  try {
    const h = new URL(src).hostname;
    return BLOCKED_SCRIPT_HOSTS.some(d => h === d || h.endsWith('.' + d));
  } catch { return false; }
}

function absoluteUrl(base: string, relative: string): string {
  if (!relative || /^(data:|blob:|mailto:|tel:|javascript:)/i.test(relative)) return relative;
  try { return new URL(relative, base).href; } catch { return relative; }
}

function proxiedUrl(slug: string, absolute: string): string {
  try {
    const u = new URL(absolute);
    return `/_proxy/${slug}${u.pathname}${u.search}${u.hash}`;
  } catch { return absolute; }
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
 * Content script injected into stored/pasted HTML.
 * Unlike the proxy variant, this one rewrites root-relative fetch()/XHR
 * directly to the original site origin rather than routing through _proxy.
 * HTML-level attributes (src/href) are handled by a <base> tag instead.
 */
function contentScriptDirect(origin: string): string {
  return (
    `<script data-proxy-injected="1">(function(){
  var origin=${JSON.stringify(origin)};
  var BLOCKED=${JSON.stringify(BLOCKED_SCRIPT_HOSTS)};
  function isBlocked(u){try{var h=new URL(u).hostname;return BLOCKED.some(function(d){return h===d||h.endsWith('.'+d);});}catch(e){return false;}}
  function rw(u){
    if(!u||typeof u!=='string')return u;
    if(u.startsWith('/')&&!u.startsWith('//')&&!u.startsWith('/_next/')&&!u.startsWith('/api/'))
      return origin+u;
    return u;
  }
  // Block analytics scripts that sneak in dynamically
  var sDesc=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');
  if(sDesc&&sDesc.set){
    Object.defineProperty(HTMLScriptElement.prototype,'src',{get:sDesc.get,set:function(v){
      if(typeof v==='string'&&isBlocked(v)){this.type='javascript/blocked';return;}
      sDesc.set.call(this,v);
    },configurable:true});
  }
  // Rewrite root-relative fetch/XHR to original origin
  var origFetch=window.fetch;
  window.fetch=function(input,init){
    if(typeof input==='string')input=rw(input);
    else if(input&&typeof input==='object'&&input.url){var u=rw(input.url);if(u!==input.url)input=new Request(u,input);}
    return origFetch.call(this,input,init);
  };
  var origOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url){
    if(typeof url==='string')url=rw(url);
    return origOpen.apply(this,[method,url].concat(Array.prototype.slice.call(arguments,2)));
  };
})();
</script>`
  );
}

async function fetchWithCookies(
  url: string,
  headers: Record<string, string>,
  maxRedirects = 10,
): Promise<Response> {
  let currentUrl = url;
  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(currentUrl, { headers, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      currentUrl = new URL(location, currentUrl).href;
    } else {
      return res;
    }
  }
  return fetch(currentUrl, { headers, redirect: 'manual' });
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

export async function GET(
  request: Request,
  { params }: { params: { site: string; path?: string[] } }
) {
  const { site, path } = params;
  const reqUrl = new URL(request.url);

  const env = getEnv();
  const cookieRow = await env.DB.prepare('SELECT cookie FROM site_cookies WHERE site_id = ?')
    .bind(site).first<{ cookie: string }>();
  const siteCookie: string | null = cookieRow ? cookieRow.cookie : null;

  // ── 1. Resolve origin ──────────────────────────────────────────────────
  let siteOrigin: string;
  let storedHtml: string | null = null;
  try {

    const row = await env.DB.prepare('SELECT origin FROM websites WHERE id = ?')
      .bind(site).first<{ origin: string }>();
    if (!row) return frameErrorResponse(`Unknown site: ${site}`);
    siteOrigin = row.origin;

    // ── Check R2 bucket for user-pasted HTML ───────────────────────────
    const r2Key = path?.length ? `${site}/${path.join('/')}` : site;
    const stored = await env.WEBPAGES_BUCKET.get(r2Key);
    if (stored) storedHtml = await stored.text();
  } catch {
    return frameErrorResponse('Database unavailable');
  }

  // ── 2. Fetch upstream HTML ─────────────────────────────────────────────
  const pathname = path?.length ? '/' + path.join('/') : '/';
  const targetUrl = `${siteOrigin}${pathname}${reqUrl.search}`;

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

      const upstream = await fetchWithCookies(targetUrl, reqHeaders);

      if (!upstream.ok) {
        return frameErrorResponse(
          `Source page returned ${upstream.status} ${upstream.statusText || 'Error'}`,
        );
      }

      html = await upstream.text();
      finalUrl = upstream.url;
    } catch (e) {
      return frameErrorResponse(`Fetch error: ${e}`);

    }
  }

  // ── 3. Stored HTML: serve with <base> tag, skip proxy rewriting ──────────
  // Assets load directly from the original site in the user's browser.
  // This avoids Akamai/bot-protection blocking our server-side proxy requests.
  if (storedHtml) {
    const $s = cheerio.load(html);
    $s('meta[http-equiv="Content-Security-Policy"]').remove();
    $s('meta[http-equiv="X-Frame-Options"]').remove();
    // Remove existing base tag so ours takes precedence
    $s('base').remove();
    // Inject base tag + direct content script
    $s('head').prepend(
      `<base href=${JSON.stringify(targetUrl)}>` +
      contentScriptDirect(siteOrigin)
    );
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
  const baseTagHref = (() => {
    const m = html.match(/<base[^>]+href=["']([^"']+)["']/i);
    return m ? m[1] : null;
  })();
  const base = (baseTagHref ? new URL(baseTagHref, pageUrl) : new URL('.', pageUrl)).href;

  const $ = cheerio.load(html);

  // Remove CSP meta tags so the page can load proxied resources
  $('meta[http-equiv="Content-Security-Policy"]').remove();
  $('meta[http-equiv="X-Frame-Options"]').remove();

  // Remove resource hints (React 19 hoists <link> elements from iframes too)
  $('link[rel~="preload"], link[rel~="prefetch"], link[rel~="modulepreload"], link[rel~="preconnect"], link[rel~="dns-prefetch"]').remove();

  // Remove blocked third-party scripts
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (isBlocked(absoluteUrl(base, src))) $(el).remove();
  });

  // Inject proxy:script-executed signals into inline scripts.
  // External scripts get the signal appended by /_proxy/route.ts instead.
  let scriptIndex = 0;
  $('script:not([src])').each((_, el) => {
    const type = $(el).attr('type') || '';
    if (type && type !== 'text/javascript' && type !== 'module' && !type.includes('javascript')) return;
    const content = $(el).text().trim();
    if (!content || isJsonOnly(content)) return;
    const id = `${targetUrl}#script-${scriptIndex++}`;
    $(el).text(`${content}`);
  });

  // Rewrite src / href / srcset / action on all elements
  $('[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (!src || /^(data:|blob:|javascript:)/i.test(src)) return;
    const abs = absoluteUrl(base, src);
    const isSameOrigin = (() => { try { return new URL(abs).origin === pageUrl.origin; } catch { return false; } })();
    $(el).attr('src', isSameOrigin ? proxiedUrl(site, abs) : abs);
  });

  $('[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) return;
    const rel = $(el).attr('rel') || '';
    // Stylesheet hrefs → proxy if same-origin, leave absolute if external CDN
    // (external font CDNs like fonts.googleapis.com have CORS headers; proxying
    // them strips their hostname and causes a 404, breaking web fonts).
    if (rel.includes('stylesheet') || el.tagName === 'link') {
      const abs = absoluteUrl(base, href);
      const isSameOrigin = (() => { try { return new URL(abs).origin === pageUrl.origin; } catch { return false; } })();
      $(el).attr('href', isSameOrigin ? proxiedUrl(site, abs) : abs);
    }
    // <a href> - rewrite to absolute so relative links don't 404 in our origin,
    // but don't proxy them (navigation is handled by the parent app).
    else if (el.tagName === 'a') {
      $(el).attr('href', absoluteUrl(base, href));
    }
  });

  // srcset
  $('[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset') || '';
    const rewritten = srcset.split(',').map(part => {
      const [u, d] = part.trim().split(/\s+/, 2);
      if (!u || /^(data:|blob:)/i.test(u)) return part;
      const abs = absoluteUrl(base, u);
      const isSameOrigin = (() => { try { return new URL(abs).origin === pageUrl.origin; } catch { return false; } })();
      const proxiedOrAbs = isSameOrigin ? proxiedUrl(site, abs) : abs;
      return d ? `${proxiedOrAbs} ${d}` : proxiedOrAbs;
    }).join(', ');
    $(el).attr('srcset', rewritten);
  });

  // Inline style url() references
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const rewritten = style.replace(/url\(['"]?([^'")]+)['"]?\)/g, (_m, u) => {
      if (/^(data:|blob:)/i.test(u)) return _m;
      const abs = absoluteUrl(base, u);
      const isSameOrigin = (() => { try { return new URL(abs).origin === pageUrl.origin; } catch { return false; } })();
      return `url(${isSameOrigin ? proxiedUrl(site, abs) : abs})`;
    });
    $(el).attr('style', rewritten);
  });

  // ── 4. Previously we injected a runtime content script here to rewrite
  // root-relative URLs inside the iframe. That work is now handled by
  // middleware which rewrites asset requests to /_proxy/{site}/… based on
  // the iframe referer, so we no longer inject the runtime interceptor.

  // ── 5. Return ─────────────────────────────────────────────────────────
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
