import assert from 'node:assert/strict';
import test from 'node:test';

import { rewriteProxyCss } from '../core/frame/proxyCss.ts';

const site = 'example-com';
const siteOrigin = 'https://example.com';
const appOrigin = 'https://annotation.mintcd.dev';
const proxyBase = `${appOrigin}/proxy/${site}`;

test('proxies stylesheet-relative and root-relative CSS resources explicitly', () => {
  assert.equal(
    rewriteProxyCss(
      '.a { background: url(../images/bg.png); } .b { src: url("/fonts/body.woff2"); }',
      `${siteOrigin}/styles/theme/main.css`,
      site,
      siteOrigin,
      appOrigin,
    ),
    `.a { background: url(${proxyBase}/styles/images/bg.png); } .b { src: url("${proxyBase}/fonts/body.woff2"); }`,
  );
});

test('rewrites URL and quoted CSS imports', () => {
  assert.equal(
    rewriteProxyCss(
      '@import url("./print.css") print; @import "../reset.css";',
      `${siteOrigin}/styles/theme/main.css`,
      site,
      siteOrigin,
      appOrigin,
    ),
    `@import url("${proxyBase}/styles/theme/print.css") print; @import "${proxyBase}/styles/reset.css";`,
  );
});

test('preserves media, layer, and supports qualifiers on imports after a stylesheet redirect', () => {
  const css = [
    '@import "./base.css" layer(base);',
    "@import '../wide.css' screen and (min-width: 40em);",
    '@import "/print.css" supports(display: grid) print;',
    '@import "theme.css" layer(theme) supports((display: grid) and (color: color(display-p3 1 0 0))) screen;',
  ].join('\n');
  const expected = [
    `@import "${proxyBase}/release/v3/styles/base.css" layer(base);`,
    `@import '${proxyBase}/release/v3/wide.css' screen and (min-width: 40em);`,
    `@import "${proxyBase}/print.css" supports(display: grid) print;`,
    `@import "${proxyBase}/release/v3/styles/theme.css" layer(theme) supports((display: grid) and (color: color(display-p3 1 0 0))) screen;`,
  ].join('\n');

  assert.equal(
    rewriteProxyCss(css, `${siteOrigin}/release/v3/styles/main.css`, site, siteOrigin, appOrigin),
    expected,
  );
});

test('uses the final stylesheet location after a redirect for relative dependencies', () => {
  assert.equal(
    rewriteProxyCss(
      '.a { background: url(images/bg.png); }',
      `${siteOrigin}/redirected/styles/main.css`,
      site,
      siteOrigin,
      appOrigin,
    ),
    `.a { background: url(${proxyBase}/redirected/styles/images/bg.png); }`,
  );
});

test('leaves CDN dependencies external and resolves protocol-relative URLs', () => {
  assert.equal(
    rewriteProxyCss(
      '@import "https://cdn.example.net/theme.css"; .a { src: url(//cdn.example.net/body.woff2); }',
      `${siteOrigin}/styles/main.css`,
      site,
      siteOrigin,
      appOrigin,
    ),
    '@import "https://cdn.example.net/theme.css"; .a { src: url(https://cdn.example.net/body.woff2); }',
  );
});

test('uses the stored site origin when a stylesheet redirects to a CDN', () => {
  assert.equal(
    rewriteProxyCss(
      `.a { background: url(images/bg.png); } .b { background: url(${siteOrigin}/images/site.png); }`,
      'https://cdn.example.net/v2/main.css',
      site,
      siteOrigin,
      appOrigin,
    ),
    `.a { background: url(https://cdn.example.net/v2/images/bg.png); } .b { background: url(${proxyBase}/images/site.png); }`,
  );
});

test('preserves local fragments and data and blob URLs', () => {
  const css = '.a { mask: url(#clip); } .b { background: url("data:image/png;base64,AAAA"); } .c { background: url(blob:https://example.com/image); }';

  assert.equal(
    rewriteProxyCss(css, `${siteOrigin}/styles/main.css`, site, siteOrigin, appOrigin),
    css,
  );
});

test('leaves scoped SVG fragment references unchanged', () => {
  const css = [
    '@scope (.diagram) {',
    '  .edge { marker-end: url(\'#arrow\'); filter: url("#shadow"); }',
    '  .shape { clip-path: url( #clip ); fill: url(#gradient); }',
    '}',
  ].join('\n');

  assert.equal(
    rewriteProxyCss(css, `${siteOrigin}/styles/diagram.css`, site, siteOrigin, appOrigin),
    css,
  );
});

test('preserves queries and fragments on mapped CSS resource URLs', () => {
  assert.equal(
    rewriteProxyCss(
      '.a { mask: url(../sprite.svg?v=2#icon); } .b { background: url(?theme=dark#rule); }',
      `${siteOrigin}/styles/main.css?version=1`,
      site,
      siteOrigin,
      appOrigin,
    ),
    `.a { mask: url(${proxyBase}/sprite.svg?v=2#icon); } .b { background: url(${proxyBase}/styles/main.css?theme=dark#rule); }`,
  );
});
