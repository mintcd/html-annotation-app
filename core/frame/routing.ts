import { toProxyAssetPathFromFrameRequest } from './urlRewrite.ts';

function isRoutePath(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function routedSite(pathname: string): string | null {
  return /^\/(?:frame|proxy)\/([A-Za-z0-9-]+)(?:\/|$)/.exec(pathname)?.[1] ?? null;
}

function isDocumentRequest(headers: Headers): boolean {
  const destination = headers.get('sec-fetch-dest')?.trim().toLowerCase();
  if (destination) return destination === 'document' || destination === 'iframe';

  const accept = headers.get('accept')?.toLowerCase() ?? '';
  return accept.includes('text/html') || accept.includes('application/xhtml+xml');
}

/** Route only requests whose destination or same-origin referer identifies a frame. */
export function frameRequestRewrite(
  request: Pick<Request, 'url' | 'method' | 'headers'>,
): string | null {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return null;

  const url = new URL(request.url);
  const { pathname } = url;
  if (
    isRoutePath(pathname, '/api')
    || isRoutePath(pathname, '/_next')
    || isRoutePath(pathname, '/_vinext')
    || isRoutePath(pathname, '/frame')
    || pathname === '/favicon.ico'
    || pathname === '/robots.txt'
  ) return null;

  const iframeNavigation = request.headers.get('sec-fetch-dest')?.toLowerCase() === 'iframe';
  if (isRoutePath(pathname, '/proxy')) {
    // A dynamically created relative link can resolve against the proxy base.
    // Navigating there still needs the frame handler's rewritten HTML.
    return iframeNavigation && routedSite(pathname)
      ? `/frame${pathname.slice('/proxy'.length)}${url.search}`
      : null;
  }

  if (iframeNavigation) {
    return /^\/[A-Za-z0-9-]+(?:\/|$)/.test(pathname)
      ? `/frame${pathname}${url.search}`
      : null;
  }

  if (isDocumentRequest(request.headers)) return null;

  const referer = request.headers.get('referer') || request.headers.get('referrer');
  if (!referer) return null;

  try {
    const source = new URL(referer);
    if (source.origin !== url.origin) return null;
    const site = routedSite(source.pathname);
    // Support the older /{site}/... document base in already saved frames.
    return site ? toProxyAssetPathFromFrameRequest(site, pathname, url.search) : null;
  } catch {
    return null;
  }
}
