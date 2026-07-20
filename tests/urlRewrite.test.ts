import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveUrl,
  rewriteCssUrls,
  toAppScopedBaseUrl,
  toProxyAssetPathFromFrameRequest,
  toProxyAssetUrl,
} from '../core/frame/urlRewrite.ts';

const appOrigin = 'https://annotation.mintcd.dev';
const site = 'alistair-cockburn-us';
const sourceOrigin = 'https://alistair.cockburn.us';

test('resolves document-relative assets against the source page directory', () => {
  assert.equal(
    resolveUrl(`${sourceOrigin}/`, 'hexFig1.png'),
    `${sourceOrigin}/hexFig1.png`,
  );
});

test('builds app-origin proxy URLs that are immune to source base tags', () => {
  const proxied = toProxyAssetUrl(site, `${sourceOrigin}/hexFig1.png`, appOrigin);

  assert.equal(proxied, `${appOrigin}/proxy/${site}/hexFig1.png`);
  assert.equal(new URL(proxied, `${sourceOrigin}/`).href, proxied);
});

test('maps source bases to app-scoped route bases for runtime-relative assets', () => {
  const appBase = toAppScopedBaseUrl(
    site,
    `${sourceOrigin}/articles/`,
    appOrigin,
  );

  assert.equal(appBase, `${appOrigin}/${site}/articles/`);
  assert.equal(
    new URL('image.png', appBase).href,
    `${appOrigin}/${site}/articles/image.png`,
  );
});

test('middleware proxy fallback strips the app route site prefix when present', () => {
  assert.equal(
    toProxyAssetPathFromFrameRequest(site, `/${site}/hexFig1.png`, '?v=1'),
    `/proxy/${site}/hexFig1.png?v=1`,
  );
  assert.equal(
    toProxyAssetPathFromFrameRequest(site, '/hexFig1.png'),
    `/proxy/${site}/hexFig1.png`,
  );
});

test('rewrites CSS references once without touching fragment-only URLs', () => {
  const rewritten = rewriteCssUrls(
    '@import url("theme.css"); @import "print.css"; .x { background: url(img/bg.png); mask: url(#clip); }',
    `${sourceOrigin}/styles/site.css`,
    (absolute) => toProxyAssetUrl(site, absolute, appOrigin),
  );

  assert.match(
    rewritten,
    new RegExp(`@import url\\("${appOrigin}/proxy/${site}/styles/theme\\.css"\\)`),
  );
  assert.match(
    rewritten,
    new RegExp(`@import "${appOrigin}/proxy/${site}/styles/print\\.css";`),
  );
  assert.match(
    rewritten,
    new RegExp(`url\\(${appOrigin}/proxy/${site}/styles/img/bg\\.png\\)`),
  );
  assert.match(rewritten, /url\(#clip\)/);
  assert.doesNotMatch(rewritten, /\/proxy\/alistair-cockburn-us\/proxy\//);
});
