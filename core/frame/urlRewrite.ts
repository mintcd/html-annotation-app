import { originToSlug } from '../utils/url.ts';

export const FRAME_ROUTE_PREFIX = '/frame';
export const PROXY_ROUTE_PREFIX = '/proxy';

const NON_FETCH_SCHEME_RE = /^(?:data|blob|mailto|tel|javascript|about):/i;
const HTTP_URL_RE = /^https?:\/\//i;

export function shouldSkipUrlRewrite(value: string, options: { skipFragments?: boolean } = {}): boolean {
  const trimmed = value.trim();
  const skipFragments = options.skipFragments ?? true;
  return !trimmed || NON_FETCH_SCHEME_RE.test(trimmed) || (skipFragments && trimmed.startsWith('#'));
}

export function resolveUrl(baseUrl: string, value: string): string {
  const trimmed = value.trim();
  if (shouldSkipUrlRewrite(trimmed, { skipFragments: false })) return value;

  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    try {
      return new URL(trimmed, new URL('.', baseUrl)).href;
    } catch {
      return value;
    }
  }
}

export function isSameOriginUrl(value: string, origin: string): boolean {
  try {
    return new URL(value).origin === origin;
  } catch {
    return false;
  }
}

export function toProxyAssetPath(site: string, targetUrl: string): string {
  const url = new URL(targetUrl);
  return `${PROXY_ROUTE_PREFIX}/${encodeURIComponent(site)}${url.pathname}${url.search}${url.hash}`;
}

export function toProxyAssetUrl(site: string, targetUrl: string, appOrigin?: string): string {
  const path = toProxyAssetPath(site, targetUrl);
  return appOrigin ? new URL(path, appOrigin).href : path;
}

export function toProxyAssetUrlForOrigin(
  targetUrl: string,
  originSlugMap: Map<string, string>,
  appOrigin?: string,
): string {
  try {
    const url = new URL(targetUrl);
    const site = originSlugMap.get(url.origin) ?? originToSlug(url.origin);
    return toProxyAssetUrl(site, url.href, appOrigin);
  } catch {
    return targetUrl;
  }
}

export function toAppScopedBaseUrl(site: string, sourceBaseUrl: string, appOrigin: string): string {
  const url = new URL(sourceBaseUrl);
  return new URL(`/${encodeURIComponent(site)}${url.pathname}`, appOrigin).href;
}

export function stripSitePrefixFromPath(site: string, pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const prefixes = Array.from(new Set([site, encodeURIComponent(site)]))
    .map((candidate) => `/${candidate}`);

  for (const prefix of prefixes) {
    if (normalizedPath === prefix) return '/';
    if (normalizedPath.startsWith(`${prefix}/`)) {
      const stripped = normalizedPath.slice(prefix.length);
      return stripped || '/';
    }
  }

  return normalizedPath;
}

export function toProxyAssetPathFromFrameRequest(
  site: string,
  requestPathname: string,
  requestSearch = '',
): string {
  const sourcePath = stripSitePrefixFromPath(site, requestPathname);
  return `${PROXY_ROUTE_PREFIX}/${encodeURIComponent(site)}${sourcePath}${requestSearch}`;
}

export function frameSiteFromPathname(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  const frameIndex = parts.findIndex(
    (part) => `/${part}` === FRAME_ROUTE_PREFIX,
  );
  return frameIndex >= 0 && parts.length > frameIndex + 1 ? parts[frameIndex + 1] : null;
}

export function rewriteSrcset(srcset: string, rewriteUrl: (url: string) => string): string {
  return srcset
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return part;

      const [url, descriptor] = trimmed.split(/\s+/, 2);
      if (!url || shouldSkipUrlRewrite(url)) return part;

      const rewritten = rewriteUrl(url);
      return descriptor ? `${rewritten} ${descriptor}` : rewritten;
    })
    .join(', ');
}

export function rewriteCssUrls(
  cssText: string,
  cssUrl: string,
  rewriteUrl: (absoluteUrl: string) => string,
): string {
  const rewriteCssReference = (rawUrl: string): string | null => {
    const url = rawUrl.trim();
    if (shouldSkipUrlRewrite(url)) return null;
    return rewriteUrl(resolveUrl(cssUrl, url));
  };

  let rewritten = cssText.replace(
    /url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g,
    (match, quote: string, rawUrl: string) => {
      const rewrittenUrl = rewriteCssReference(rawUrl);
      return rewrittenUrl ? `url(${quote}${rewrittenUrl}${quote})` : match;
    },
  );

  rewritten = rewritten.replace(
    /@import\s+(['"])([^'";\)]+)\1\s*;/g,
    (match, quote: string, rawUrl: string) => {
      const rewrittenUrl = rewriteCssReference(rawUrl);
      return rewrittenUrl ? `@import ${quote}${rewrittenUrl}${quote};` : match;
    },
  );

  return rewritten;
}

function isAlreadyAppProxyUrl(value: string): boolean {
  try {
    return new URL(value, 'https://annotation.local').pathname.startsWith(`${PROXY_ROUTE_PREFIX}/`);
  } catch {
    return false;
  }
}

function shouldRewriteInlineScriptUrl(value: string): boolean {
  const trimmed = value.trim();
  return !shouldSkipUrlRewrite(trimmed)
    && !HTTP_URL_RE.test(trimmed)
    && !trimmed.startsWith('//')
    && !isAlreadyAppProxyUrl(trimmed);
}

export function rewriteInlineScriptAssetReferences(
  scriptText: string,
  baseUrl: string,
  rewriteUrl: (absoluteUrl: string) => string,
): string {
  let rewritten = scriptText;

  rewritten = rewritten.replace(
    /(?:["']?)src(?:["']?)\s*:\s*("|')(.*?)\1/g,
    (match: string, quote: string, rawUrl: string) => {
      if (!shouldRewriteInlineScriptUrl(rawUrl)) return match;
      return `src: ${quote}${rewriteUrl(resolveUrl(baseUrl, rawUrl))}${quote}`;
    },
  );

  rewritten = rewritten.replace(
    /\.src\s*=\s*("|')(.*?)\1/g,
    (match: string, _quote: string, rawUrl: string) => {
      if (!shouldRewriteInlineScriptUrl(rawUrl)) return match;
      return match.replace(rawUrl, rewriteUrl(resolveUrl(baseUrl, rawUrl)));
    },
  );

  rewritten = rewritten.replace(
    /setAttribute\(\s*("|')src\1\s*,\s*("|')(.*?)\2\s*\)/g,
    (match: string, _attrQuote: string, _urlQuote: string, rawUrl: string) => {
      if (!shouldRewriteInlineScriptUrl(rawUrl)) return match;
      return match.replace(rawUrl, rewriteUrl(resolveUrl(baseUrl, rawUrl)));
    },
  );

  rewritten = rewritten.replace(
    /(\w+)\s*:\s*['"](\/[^'"]*)['"]/g,
    (match: string, prop: string, rawUrl: string) => {
      if (prop !== 'src' || !shouldRewriteInlineScriptUrl(rawUrl)) return match;
      return `${prop}: '${rewriteUrl(resolveUrl(baseUrl, rawUrl))}'`;
    },
  );

  return rewritten;
}
