export type ExternalLinkResolutionOptions = {
  appOrigin: string;
  sourcePageUrl?: string;
  sourceBaseUrl?: string;
  documentBaseUrl?: string;
  documentUrl?: string;
};

export const FRAME_SOURCE_BASE_META_NAME = 'annotation-source-base';

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function linkResolutionBase({
  appOrigin,
  sourcePageUrl,
  sourceBaseUrl,
  documentBaseUrl,
  documentUrl,
}: ExternalLinkResolutionOptions): string | undefined {
  const sourceBaseOrigin = originOf(sourceBaseUrl);
  if (sourceBaseUrl && sourceBaseOrigin && sourceBaseOrigin !== appOrigin) {
    return sourceBaseUrl;
  }

  const documentBaseOrigin = originOf(documentBaseUrl);
  if (documentBaseUrl && documentBaseOrigin && documentBaseOrigin !== appOrigin) {
    return documentBaseUrl;
  }
  return sourcePageUrl || documentBaseUrl || documentUrl;
}

function sourceUrlFromProxy(link: URL, options: ExternalLinkResolutionOptions): string | null {
  if (!options.sourcePageUrl || !options.documentUrl) return null;

  const documentUrl = new URL(options.documentUrl);
  if (documentUrl.origin !== options.appOrigin) return null;
  const site = /^\/(?:frame|proxy)\/([A-Za-z0-9-]+)(?:\/|$)/.exec(documentUrl.pathname)?.[1];
  if (!site) return null;

  const prefix = `/proxy/${site}`;
  if (link.pathname !== prefix && !link.pathname.startsWith(`${prefix}/`)) return null;

  const origin = new URL(options.sourcePageUrl).origin;
  const path = link.pathname.slice(prefix.length) || '/';
  const fragment = link.hash || (link.href.endsWith('#') ? '#' : '');
  return `${origin}${path}${link.search}${fragment}`;
}

export function resolveExternalLinkHref(
  rawHref: string | null | undefined,
  options: ExternalLinkResolutionOptions,
): string | null {
  const href = rawHref?.trim();
  if (!href) return null;

  const lowerHref = href.toLowerCase();
  if (lowerHref.startsWith('javascript:')) return null;

  try {
    const { appOrigin } = options;
    const base = linkResolutionBase(options);
    const linkUrl = new URL(href, base);
    if (linkUrl.protocol !== 'http:' && linkUrl.protocol !== 'https:') return null;
    if (linkUrl.origin === appOrigin) return sourceUrlFromProxy(linkUrl, options);
    return linkUrl.href;
  } catch {
    return null;
  }
}
