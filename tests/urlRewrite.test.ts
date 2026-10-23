import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveUrl,
  rewriteCssUrls,
  sourcePathnameFromRoute,
  toProxyAssetPathFromFrameRequest,
  toProxyAssetUrl,
} from '../core/frame/urlRewrite.ts';

const appOrigin = 'https://annotation.mintcd.dev';
const site = 'alistair-cockburn-us';
const sourceOrigin = 'https://alistair.cockburn.us';

test('preserves source directory slashes and file paths from frame and proxy requests', () => {
  for (const prefix of ['/frame/site', '/proxy/site', '/site']) {
    assert.equal(sourcePathnameFromRoute(['articles'], `${prefix}/articles/`), '/articles/');
    assert.equal(sourcePathnameFromRoute(['articles'], `${prefix}/articles`), '/articles');
    assert.equal(
      sourcePathnameFromRoute(['articles', 'page.html'], `${prefix}/articles/page.html`),
      '/articles/page.html',
    );
    assert.equal(sourcePathnameFromRoute(undefined, prefix), '/');
    assert.equal(sourcePathnameFromRoute([], `${prefix}/`), '/');
  }
});

test('encodes decoded route segments without turning reserved characters into URL delimiters', () => {
  const pathname = sourcePathnameFromRoute(
    ['query?edition=2', 'hash#section', 'slash/name', '100%', '%2F', 'café', '東京'],
    '/proxy/site/encoded',
  );
  const expected = '/query%3Fedition%3D2/hash%23section/slash%2Fname/100%25/%252F/caf%C3%A9/%E6%9D%B1%E4%BA%AC';

  assert.equal(pathname, expected);
  const upstream = new URL(`${sourceOrigin}${pathname}?version=1`);
  assert.equal(upstream.pathname, expected);
  assert.equal(upstream.search, '?version=1');
  assert.equal(upstream.hash, '');
});

test('distinguishes an encoded source slash from the request trailing slash', () => {
  assert.equal(sourcePathnameFromRoute(['folder/name'], '/proxy/site/folder%2Fname'), '/folder%2Fname');
  assert.equal(sourcePathnameFromRoute(['folder/name'], '/proxy/site/folder%2Fname/'), '/folder%2Fname/');
});

test('handles empty route segments without adding duplicate trailing slashes', () => {
  assert.equal(sourcePathnameFromRoute(['folder', ''], '/proxy/site/folder/'), '/folder/');
  assert.equal(sourcePathnameFromRoute([''], '/proxy/site/'), '/');
  assert.equal(sourcePathnameFromRoute(['folder', '', 'file'], '/proxy/site/folder//file'), '/folder//file');
});

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

test('maps source bases directly to proxy routes for runtime-relative assets', () => {
  const appBase = toProxyAssetUrl(
    site,
    `${sourceOrigin}/articles/`,
    appOrigin,
  );

  assert.equal(appBase, `${appOrigin}/proxy/${site}/articles/`);
  assert.equal(
    new URL('image.png', appBase).href,
    `${appOrigin}/proxy/${site}/articles/image.png`,
  );
});

test('preserves complete document paths and queries in proxy document bases', () => {
  const appBase = toProxyAssetUrl(
    site,
    `${sourceOrigin}/articles/page.html?edition=2`,
    appOrigin,
  );

  assert.equal(appBase, `${appOrigin}/proxy/${site}/articles/page.html?edition=2`);
  assert.equal(new URL('#section', appBase).href, `${appBase}#section`);
  assert.equal(new URL('image.png', appBase).href, `${appOrigin}/proxy/${site}/articles/image.png`);
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
