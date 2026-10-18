export function scrollToFrameFragment(doc: Document, fragment: string): boolean {
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
    if (!target.hash) return null;

    const sameDocument = target.origin === current.origin
      && comparablePathname(target.pathname) === comparablePathname(current.pathname)
      && target.search === current.search;

    return sameDocument ? target.hash : null;
  } catch {
    return null;
  }
}
