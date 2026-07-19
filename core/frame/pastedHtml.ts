const SITE_ID_PATTERN = /^[A-Za-z0-9-]+$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

export class WebpageStorageKeyError extends Error {}

export type WebpageStoragePathInput = string | readonly string[] | null | undefined;

export function validateWebpageSiteId(site: string): string {
  const siteId = site.trim();
  if (!SITE_ID_PATTERN.test(siteId)) {
    throw new WebpageStorageKeyError('Invalid site id.');
  }
  return siteId;
}

export function normalizeWebpageStoragePath(path: WebpageStoragePathInput): string {
  if (path === null || path === undefined) return '';

  const rawPath = Array.isArray(path) ? path.join('/') : path;
  if (typeof rawPath !== 'string') {
    throw new WebpageStorageKeyError('Invalid page path.');
  }

  const normalized = rawPath.replace(/^\/+|\/+$/g, '');
  if (normalized === '') return '';

  const segments = normalized.split('/');
  for (const segment of segments) {
    if (
      segment === ''
      || segment === '.'
      || segment === '..'
      || segment.includes('\\')
      || CONTROL_CHARACTER_PATTERN.test(segment)
    ) {
      throw new WebpageStorageKeyError('Invalid page path.');
    }
  }

  return segments.join('/');
}

export function webpageStorageKey(site: string, path: WebpageStoragePathInput): string {
  const siteId = validateWebpageSiteId(site);
  const storagePath = normalizeWebpageStoragePath(path);
  return storagePath ? `${siteId}/${storagePath}` : siteId;
}
