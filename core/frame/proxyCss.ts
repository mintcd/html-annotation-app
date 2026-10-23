import { isSameOriginUrl, rewriteCssUrls, toProxyAssetUrl } from './urlRewrite.ts';

export function rewriteProxyCss(
  cssText: string,
  sourceCssUrl: string,
  site: string,
  siteOrigin: string,
  appOrigin: string,
): string {
  return rewriteCssUrls(cssText, sourceCssUrl, (absoluteUrl) => (
    isSameOriginUrl(absoluteUrl, siteOrigin)
      ? toProxyAssetUrl(site, absoluteUrl, appOrigin)
      : absoluteUrl
  ));
}
