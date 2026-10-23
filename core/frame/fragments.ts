export function scrollToFrameFragment(doc: Document, fragment: string): boolean {
  if (fragment === '#') {
    doc.documentElement.scrollIntoView({ behavior: 'auto', block: 'start' });
    return true;
  }
  const rawIdentifier = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (!rawIdentifier) return false;

  let identifier = rawIdentifier;
  try {
    identifier = decodeURIComponent(rawIdentifier);
  } catch {
    // Invalid percent escapes are still valid literal characters in an id.
  }

  const target = doc.getElementById(identifier) ?? doc.getElementsByName(identifier).item(0);
  if (!target) return false;

  target.scrollIntoView({ behavior: 'auto', block: 'start' });
  return true;
}

function comparablePathname(pathname: string): string {
  return pathname === '/' ? pathname : pathname.replace(/\/+$/, '');
}

export function sameDocumentFragment(targetUrl: string, currentPageUrl: string): string | null {
  try {
    const target = new URL(targetUrl);
    const current = new URL(currentPageUrl);
    const fragment = target.hash || (target.href.endsWith('#') ? '#' : '');
    if (!fragment) return null;

    const sameDocument = target.origin === current.origin
      && comparablePathname(target.pathname) === comparablePathname(current.pathname)
      && target.search === current.search;

    return sameDocument ? fragment : null;
  } catch {
    return null;
  }
}

export function navigateToFrameFragment(
  doc: Document,
  targetUrl: string,
  currentPageUrl: string,
  appWindow: Pick<Window, 'location' | 'history'>,
): boolean {
  const fragment = sameDocumentFragment(targetUrl, currentPageUrl);
  if (!fragment) return false;

  const appUrl = new URL(appWindow.location.href);
  appUrl.hash = fragment;
  appWindow.history.pushState(null, '', `${appUrl.pathname}${appUrl.search}${appUrl.hash}`);
  scrollToFrameFragment(doc, fragment);
  return true;
}
