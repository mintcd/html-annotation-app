import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware: rewrite iframe navigations to internal /_frame handler.
export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const { pathname } = url;

  // Skip internal or static routes
  if (
    pathname.startsWith('/_') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt') ||
    pathname.includes('/_next/')
  ) {
    return NextResponse.next();
  }

  // Only consider GET/HEAD navigations
  // Only consider GET/HEAD/OPTIONS for resource rewrites; allow other methods
  // to pass through so API calls aren't accidentally rewritten.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return NextResponse.next();

  // 1) If the request came from a proxied iframe (referer contains /_frame/{site}),
  //    rewrite non-document resource requests to /_proxy/{site}/… so assets load.
  const referer = req.headers.get('referer') || req.headers.get('referrer') || '';
  // Fallback: if the frame handler set a cookie with the site slug, use that
  // when Referer is absent or suppressed.
  const cookieHeader = req.headers.get('cookie') || '';
  const proxyCookie = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('__proxy_site='));
  if (!referer && proxyCookie) {
    try {
      const site = proxyCookie.split('=')[1];
      const accept = (req.headers.get('accept') || '').toLowerCase();
      if (!accept.includes('text/html')) {
        const dest = `/_proxy/${site}${pathname}${url.search}`;
        return NextResponse.rewrite(new URL(dest, req.url));
      }
    } catch (e) {
      // ignore
    }
  }
  if (referer) {
    try {
      const r = new URL(referer);
      const refParts = r.pathname.split('/').filter(Boolean);
      const frameIndex = refParts.indexOf('_frame');
      if (frameIndex >= 0 && refParts.length > frameIndex + 1) {
        const site = refParts[frameIndex + 1];
        const accept = (req.headers.get('accept') || '').toLowerCase();
        // Skip HTML navigations — only rewrite resource requests
        if (!accept.includes('text/html')) {
          const dest = `/_proxy/${site}${pathname}${url.search}`;
          return NextResponse.rewrite(new URL(dest, req.url));
        }
      }
    } catch (e) {
      // ignore invalid referer
    }
  }

  // 2) Fallback: detect iframe navigation (sec-fetch-dest) or explicit flag
  const isIframe =
    req.headers.get('sec-fetch-dest') === 'iframe' ||
    url.searchParams.has('_frame') ||
    url.searchParams.has('frame');

  if (!isIframe) return NextResponse.next();

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return NextResponse.next();
  const site = parts.shift();
  const rest = parts.join('/');
  const dest = `/_frame/${site}${rest ? '/' + rest : ''}${url.search}`;

  return NextResponse.rewrite(new URL(dest, req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|_next|api|_proxy|_frame).*)'],
};
