import type * as cheerio from 'cheerio';

import { htmlSourceBase, installFrameSourceBase } from './sourceBase.ts';
import {
  isSameOriginUrl,
  resolveUrl,
  rewriteCssUrls,
  rewriteSrcset,
  shouldSkipUrlRewrite,
  toProxyAssetUrl,
} from './urlRewrite.ts';

type FrameUrlOptions = {
  site: string;
  siteOrigin: string;
  sourceUrl: string;
  appOrigin: string;
};

export function rewriteFrameUrls($: cheerio.CheerioAPI, options: FrameUrlOptions): void {
  const { site, siteOrigin, sourceUrl, appOrigin } = options;
  const sourceBase = htmlSourceBase($, sourceUrl);
  const documentBase = isSameOriginUrl(sourceBase, siteOrigin)
    ? toProxyAssetUrl(site, sourceBase, appOrigin)
    : sourceBase;

  // Relative resources can use the browser's normal URL resolution. Rewrite
  // only references that would otherwise escape the correct source/proxy URL.
  const resourceUrl = (absolute: string, raw = absolute): string => {
    const target = isSameOriginUrl(absolute, siteOrigin)
      ? toProxyAssetUrl(site, absolute, appOrigin)
      : absolute;
    return resolveUrl(documentBase, raw) === target ? raw : target;
  };
  const rewriteResource = (raw: string): string => resourceUrl(resolveUrl(sourceBase, raw), raw);

  installFrameSourceBase($, sourceBase, documentBase);

  $('[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (!shouldSkipUrlRewrite(src)) $(el).attr('src', rewriteResource(src));
  });

  $('[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (shouldSkipUrlRewrite(href, { skipFragments: false })) return;
    if (el.tagName === 'link') {
      if (!shouldSkipUrlRewrite(href)) {
        $(el).attr('href', rewriteResource(href));
        const stylesheet = ($(el).attr('rel') || '').toLowerCase().split(/\s+/).includes('stylesheet');
        if (stylesheet && isSameOriginUrl(resolveUrl(sourceBase, href), siteOrigin)) {
          // The CSS proxy rewrites dependencies, so the original byte hash
          // no longer describes the response served to the browser.
          $(el).removeAttr('integrity');
        }
      }
    } else if (el.tagName === 'a' || el.tagName === 'area') {
      // Keep modified clicks and native navigation on the original website.
      // Normal clicks are resolved by the parent annotator's link interceptor.
      $(el).attr('href', resolveUrl(sourceBase, href));
    }
  });

  $('[action]').each((_, el) => {
    const action = $(el).attr('action') || '';
    if (!shouldSkipUrlRewrite(action, { skipFragments: false })) {
      $(el).attr('action', resolveUrl(sourceBase, action));
    }
  });

  $('[srcset]').each((_, el) => {
    $(el).attr('srcset', rewriteSrcset($(el).attr('srcset') || '', rewriteResource));
  });

  $('[style]').each((_, el) => {
    $(el).attr('style', rewriteCssUrls($(el).attr('style') || '', sourceBase, resourceUrl));
  });
  $('style').each((_, el) => {
    $(el).text(rewriteCssUrls($(el).html() || '', sourceBase, resourceUrl));
  });
}
