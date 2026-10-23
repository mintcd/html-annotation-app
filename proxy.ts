import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { frameRequestRewrite } from './core/frame/routing';

export function proxy(request: NextRequest) {
  const destination = frameRequestRewrite(request);
  return destination
    ? NextResponse.rewrite(new URL(destination, request.url))
    : NextResponse.next();
}

export const config = {
  // Proxy assets normally pass through. Iframe navigations into /proxy need
  // middleware so they receive the rewritten frame document instead.
  matcher: ['/((?!_next(?:/|$)|_vinext(?:/|$)|api(?:/|$)|frame(?:/|$)).*)'],
};
