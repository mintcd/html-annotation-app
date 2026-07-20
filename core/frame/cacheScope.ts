import { normalizeUserId } from '../persistence/syncIdentity.ts';

export const FRAME_CACHE_SCOPE_PARAM = '__annotation_cache_scope';

export function frameCacheScopeForUserId(userId: string): string {
  return `u-${stableScopeId(normalizeUserId(userId))}`;
}

export function withFrameCacheScope(
  frameUrl: string,
  userId: string,
  base?: string,
): string {
  const absoluteInput = /^[a-z][a-z0-9+.-]*:/i.test(frameUrl);
  const fallbackBase = base
    ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const url = new URL(frameUrl, fallbackBase);
  url.searchParams.set(FRAME_CACHE_SCOPE_PARAM, frameCacheScopeForUserId(userId));
  return absoluteInput ? url.href : `${url.pathname}${url.search}${url.hash}`;
}

export function stripFrameCacheScopeFromSearch(search: string): string {
  if (!search) return '';

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete(FRAME_CACHE_SCOPE_PARAM);

  const normalized = params.toString();
  return normalized ? `?${normalized}` : '';
}

function stableScopeId(value: string): string {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }

  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}
