const SITE_ID_PATTERN = /^[A-Za-z0-9-]+$/;
const STORAGE_OWNER_PATTERN = /^[A-Za-z0-9_-]+$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const ROOT_PATH_SEGMENT = '__root__';
const EMPTY_SEARCH_SEGMENT = 'query-none';

export class WebpageStorageKeyError extends Error {}

export type WebpageStoragePathInput = string | readonly string[] | null | undefined;
export type WebpageStorageSearchInput = string | null | undefined;

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

export function validateWebpageStorageOwnerId(ownerId: string): string {
  const normalized = ownerId.trim().toLowerCase();
  if (!STORAGE_OWNER_PATTERN.test(normalized)) {
    throw new WebpageStorageKeyError('Invalid storage owner id.');
  }
  return normalized;
}

export function normalizeWebpageStorageSearch(search: WebpageStorageSearchInput): string {
  if (search === null || search === undefined) return '';

  const rawSearch = search.trim();
  if (rawSearch === '' || rawSearch === '?') return '';
  if (CONTROL_CHARACTER_PATTERN.test(rawSearch)) {
    throw new WebpageStorageKeyError('Invalid page search.');
  }

  const query = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
  const normalized = new URLSearchParams(query).toString();
  return normalized ? `?${normalized}` : '';
}

export function webpageStorageKey(site: string, path: WebpageStoragePathInput): string {
  const siteId = validateWebpageSiteId(site);
  const storagePath = normalizeWebpageStoragePath(path);
  return storagePath ? `${siteId}/${storagePath}` : siteId;
}

export function scopedWebpageStorageKey(
  ownerId: string,
  site: string,
  path: WebpageStoragePathInput,
  search?: WebpageStorageSearchInput,
): string {
  const owner = validateWebpageStorageOwnerId(ownerId);
  const siteId = validateWebpageSiteId(site);
  const storagePath = normalizeWebpageStoragePath(path);
  const pagePath = storagePath || ROOT_PATH_SEGMENT;
  const normalizedSearch = normalizeWebpageStorageSearch(search);
  const searchSegment = normalizedSearch
    ? `query-${stableStorageId(normalizedSearch)}`
    : EMPTY_SEARCH_SEGMENT;

  return `users/${owner}/webpages/${siteId}/${pagePath}/${searchSegment}`;
}

function stableStorageId(value: string): string {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }

  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}
