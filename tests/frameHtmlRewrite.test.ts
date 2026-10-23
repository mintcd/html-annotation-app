import assert from 'node:assert/strict';
import test from 'node:test';

import * as cheerio from 'cheerio';

import { FRAME_SOURCE_BASE_META_NAME, resolveExternalLinkHref } from '../core/frame/externalLinks.ts';
import { sameDocumentFragment } from '../core/frame/fragments.ts';
import { rewriteFrameUrls } from '../core/frame/rewriteHtml.ts';
import { toAnnotatorPath } from '../core/utils/url.ts';

const appOrigin = 'https://annotation.mintcd.dev';
const siteOrigin = 'https://plato.stanford.edu';
const site = 'plato-stanford-edu';
const sourceUrl = `${siteOrigin}/entries/computing-history/`;
const proxyOrigin = `${appOrigin}/proxy/${site}`;

function rewrite(html: string, pageUrl = sourceUrl) {
  const $ = cheerio.load(html);
  rewriteFrameUrls($, { site, siteOrigin, sourceUrl: pageUrl, appOrigin });
  return $;
}

function resolvedAttribute($: cheerio.CheerioAPI, selector: string, attribute: string): string {
  return new URL($(selector).attr(attribute)!, $('base').attr('href')).href;
}

test('uses the proxy base for native relative assets and keeps source metadata for navigation', () => {
  const $ = rewrite(`
    <link rel="stylesheet" href="styles/main.css">
    <script src="scripts/main.js"></script>
    <img src="images/analog.svg">
    <style>.figure { background: url(images/bg.png); mask: url(#clip); }</style>
    <div style="background: url(images/bg.png)"></div>
  `);

  assert.equal($('base').attr('href'), `${proxyOrigin}/entries/computing-history/`);
  assert.equal($(`meta[name="${FRAME_SOURCE_BASE_META_NAME}"]`).attr('content'), sourceUrl);
  assert.equal($('img').attr('src'), 'images/analog.svg');
  assert.equal($('script').attr('src'), 'scripts/main.js');
  assert.equal($('link').attr('href'), 'styles/main.css');
  assert.equal(resolvedAttribute($, 'img', 'src'), `${proxyOrigin}/entries/computing-history/images/analog.svg`);
  assert.equal($('style').text(), '.figure { background: url(images/bg.png); mask: url(#clip); }');
  assert.equal($('div').attr('style'), 'background: url(images/bg.png)');
  assert.equal(new URL('runtime.js', $('base').attr('href')).href, `${proxyOrigin}/entries/computing-history/runtime.js`);
});

test('rewrites references that would escape or bypass the proxy base', () => {
  const references = [
    '/images/root.svg',
    `${siteOrigin}/images/absolute.svg`,
    '//plato.stanford.edu/images/protocol.svg',
    '../../../../images/clamped.svg',
    `/${site}/images/source-path.svg`,
  ];

  for (const reference of references) {
    const $ = rewrite(`<img src="${reference}">`);
    const target = new URL(reference, sourceUrl);
    assert.equal(
      resolvedAttribute($, 'img', 'src'),
      `${proxyOrigin}${target.pathname}${target.search}${target.hash}`,
      reference,
    );
    assert.ok($('img').attr('src')!.startsWith(`${proxyOrigin}/`));
  }
});

test('preserves file paths, queries, and native relative resolution', () => {
  const $ = rewrite('<img id="query" src="?download=1"><img id="relative" src="figure.svg">', `${siteOrigin}/entries/page.html?edition=2`);

  assert.equal($('base').attr('href'), `${proxyOrigin}/entries/page.html?edition=2`);
  assert.equal($('#query').attr('src'), '?download=1');
  assert.equal(resolvedAttribute($, '#query', 'src'), `${proxyOrigin}/entries/page.html?download=1`);
  assert.equal(resolvedAttribute($, '#relative', 'src'), `${proxyOrigin}/entries/figure.svg`);
});

test('keeps links and form actions source-absolute including the original Stanford anchor', () => {
  const $ = rewrite('<a href="#analog">Analog</a><area href="../time/#Fata"><form action="?search=analog"></form>');
  const target = `${sourceUrl}#analog`;

  assert.equal($('a').attr('href'), target);
  assert.equal($('area').attr('href'), `${siteOrigin}/entries/time/#Fata`);
  assert.equal($('form').attr('action'), `${sourceUrl}?search=analog`);
  assert.equal(resolveExternalLinkHref($('a').attr('href'), {
    appOrigin,
    sourcePageUrl: sourceUrl,
    sourceBaseUrl: $(`meta[name="${FRAME_SOURCE_BASE_META_NAME}"]`).attr('content'),
    documentBaseUrl: $('base').attr('href'),
  }), target);
  assert.equal(toAnnotatorPath(site, target), `/${site}/entries/computing-history/#analog`);
  assert.equal(sameDocumentFragment(target, sourceUrl.replace(/\/$/, '')), '#analog');

  const top = rewrite('<a href="#">Top</a>');
  assert.equal(top('a').attr('href'), `${sourceUrl}#`);
  assert.equal(sameDocumentFragment(top('a').attr('href')!, sourceUrl), '#');
});

test('respects authored bases while keeping cross-origin resources direct', () => {
  const sameOrigin = rewrite('<base href="../shared/"><img src="figure.svg">');
  assert.equal(resolvedAttribute(sameOrigin, 'img', 'src'), `${proxyOrigin}/entries/shared/figure.svg`);

  const external = rewrite(`<base href="https://cdn.example.com/v2/"><img id="cdn" src="figure.svg"><img id="site" src="${siteOrigin}/logo.svg"><a href="#notes">Notes</a>`);
  assert.equal(external('base').attr('href'), 'https://cdn.example.com/v2/');
  assert.equal(resolvedAttribute(external, '#cdn', 'src'), 'https://cdn.example.com/v2/figure.svg');
  assert.equal(external('#site').attr('src'), `${proxyOrigin}/logo.svg`);
  assert.equal(external('a').attr('href'), 'https://cdn.example.com/v2/#notes');
});

test('does not proxy a cross-origin redirected page under the wrong stored site origin', () => {
  const $ = rewrite(`<img id="cdn" src="figure.svg"><img id="site" src="${siteOrigin}/logo.svg">`, 'https://cdn.example.com/article/');

  assert.equal($('base').attr('href'), 'https://cdn.example.com/article/');
  assert.equal(resolvedAttribute($, '#cdn', 'src'), 'https://cdn.example.com/article/figure.svg');
  assert.equal($('#site').attr('src'), `${proxyOrigin}/logo.svg`);
});

test('ignores canonical and Open Graph URLs when resolving fetched-page assets', () => {
  const $ = rewrite(`<link rel="canonical" href="${sourceUrl}"><meta property="og:url" content="${sourceUrl}"><img src="figure.svg">`, sourceUrl.replace(/\/$/, ''));

  assert.equal(resolvedAttribute($, 'img', 'src'), `${proxyOrigin}/entries/figure.svg`);
  assert.equal($('base').attr('href'), `${proxyOrigin}/entries/computing-history`);
});

test('preserves srcset descriptors while mapping root and absolute candidates', () => {
  const $ = rewrite(`<img srcset="small.png 1x, /large.png 2x, ${siteOrigin}/wide.png 3x">`);

  assert.equal($('img').attr('srcset'), `small.png 1x, ${proxyOrigin}/large.png 2x, ${proxyOrigin}/wide.png 3x`);
});

test('rewrites exceptional inline CSS URLs while preserving import qualifiers and SVG fragments', () => {
  const $ = rewrite('<style>@import "/theme.css" layer(theme) screen; .x { background: url(/images/bg.png); mask: url(#clip); }</style>');

  assert.equal($('style').text(), `@import "${proxyOrigin}/theme.css" layer(theme) screen; .x { background: url(${proxyOrigin}/images/bg.png); mask: url(#clip); }`);
});

test('retains non-fetch URLs and external CDN references', () => {
  const $ = rewrite('<img src="data:image/png;base64,AAAA"><script src="https://cdn.example.com/app.js"></script><a href="mailto:reader@example.com">Mail</a><a href="javascript:void(0)">Action</a>');

  assert.equal($('img').attr('src'), 'data:image/png;base64,AAAA');
  assert.equal($('script').attr('src'), 'https://cdn.example.com/app.js');
  assert.equal($('a').eq(0).attr('href'), 'mailto:reader@example.com');
  assert.equal($('a').eq(1).attr('href'), 'javascript:void(0)');
});

test('removes integrity only from stylesheets whose proxy response is rewritten', () => {
  const $ = rewrite('<link id="local" rel="stylesheet" href="styles/main.css" integrity="sha256-local"><link id="cdn" rel="stylesheet" href="https://cdn.example.com/main.css" integrity="sha256-cdn"><script src="scripts/main.js" integrity="sha256-script"></script>');

  assert.equal($('#local').attr('integrity'), undefined);
  assert.equal($('#cdn').attr('integrity'), 'sha256-cdn');
  assert.equal($('script').attr('integrity'), 'sha256-script');
});
