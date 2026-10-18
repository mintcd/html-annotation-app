import type * as cheerio from 'cheerio';

import { FRAME_SOURCE_BASE_META_NAME } from './externalLinks.ts';

function validSourceBase(value: string | undefined, fallback: string): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value, fallback);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

export function storedHtmlSourceBase($: cheerio.CheerioAPI, fallback: string): string {
  const authoredBase = validSourceBase($('base[href]').first().attr('href'), fallback);
  if (authoredBase) return authoredBase;

  const fallbackUrl = new URL(fallback);
  const directoryCandidates = [
    $('link[rel~="canonical"][href]').first().attr('href'),
    $('meta[property="og:url"][content]').first().attr('content'),
  ];

  for (const candidate of directoryCandidates) {
    const resolved = validSourceBase(candidate, fallback);
    if (!resolved) continue;

    const resolvedUrl = new URL(resolved);
    const sameDocumentPath = resolvedUrl.origin === fallbackUrl.origin
      && resolvedUrl.pathname.replace(/\/$/, '') === fallbackUrl.pathname.replace(/\/$/, '');
    if (sameDocumentPath && resolvedUrl.pathname.endsWith('/')) return resolved;
  }

  return fallback;
}

export function installFrameSourceBase(
  $: cheerio.CheerioAPI,
  sourceBase: string,
  documentBase = sourceBase,
): void {
  $('base').remove();
  $('<base>').attr('href', documentBase).prependTo('head');

  $(`meta[name="${FRAME_SOURCE_BASE_META_NAME}"]`).remove();
  $('<meta>')
    .attr('name', FRAME_SOURCE_BASE_META_NAME)
    .attr('content', sourceBase)
    .appendTo('head');
}
