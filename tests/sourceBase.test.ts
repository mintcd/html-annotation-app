import assert from 'node:assert/strict';
import test from 'node:test';

import * as cheerio from 'cheerio';

import { FRAME_SOURCE_BASE_META_NAME, resolveExternalLinkHref } from '../core/frame/externalLinks.ts';
import { htmlSourceBase, installFrameSourceBase, storedHtmlSourceBase } from '../core/frame/sourceBase.ts';
import { toProxyAssetUrl } from '../core/frame/urlRewrite.ts';

const sourcePage = 'https://plato.stanford.edu/entries/time';
const sourceDirectory = `${sourcePage}/`;

test('restores stored HTML directory semantics before resolving anchored links', () => {
  const $ = cheerio.load(`
    <html>
      <head><link rel="canonical" href="${sourceDirectory}"></head>
      <body><a href="./#Fata">Fatalism</a></body>
    </html>
  `);

  const sourceBase = storedHtmlSourceBase($, sourcePage);
  installFrameSourceBase($, sourceBase);

  assert.equal(sourceBase, sourceDirectory);
  assert.equal($('base').attr('href'), sourceDirectory);
  assert.equal(
    $(`meta[name="${FRAME_SOURCE_BASE_META_NAME}"]`).attr('content'),
    sourceDirectory,
  );
  assert.equal(new URL($('a').attr('href')!, $('base').attr('href')).href, `${sourceDirectory}#Fata`);
});

test('keeps an external source base when the iframe document base uses the proxy route', () => {
  const appOrigin = 'http://localhost:5001';
  const $ = cheerio.load('<html><head></head><body><a href="./#Fata">Fatalism</a></body></html>');

  installFrameSourceBase(
    $,
    sourceDirectory,
    `${appOrigin}/proxy/plato-stanford-edu/entries/time/`,
  );

  const sourceBaseUrl = $(`meta[name="${FRAME_SOURCE_BASE_META_NAME}"]`).attr('content');
  assert.equal(
    resolveExternalLinkHref('./#Fata', {
      appOrigin,
      sourcePageUrl: sourcePage,
      sourceBaseUrl,
      documentBaseUrl: $('base').attr('href'),
    }),
    `${sourceDirectory}#Fata`,
  );
});

test('retains the complete fetched page path when resolving fragment links without a canonical URL', () => {
  const appOrigin = 'https://annotation.mintcd.dev';
  const sourceUrl = 'https://plato.stanford.edu/entries/computing-history';
  const $ = cheerio.load('<html><head></head><body><a href="#analog">Analog</a></body></html>');
  const sourceBase = htmlSourceBase($, sourceUrl);

  installFrameSourceBase($, sourceBase, toProxyAssetUrl('plato-stanford-edu', sourceBase, appOrigin));

  assert.equal(sourceBase, sourceUrl);
  assert.equal(
    new URL($('a').attr('href')!, $('base').attr('href')).href,
    `${appOrigin}/proxy/plato-stanford-edu/entries/computing-history#analog`,
  );
});

test('keeps the fetched response URL as its base even when canonical metadata has a trailing slash', () => {
  const appOrigin = 'https://annotation.mintcd.dev';
  const sourceUrl = 'https://plato.stanford.edu/entries/computing-history';
  const $ = cheerio.load(`
    <html>
      <head><link rel="canonical" href="${sourceUrl}/"></head>
      <body><a href="./#analog">Analog</a></body>
    </html>
  `);
  const sourceBase = htmlSourceBase($, sourceUrl);

  installFrameSourceBase($, sourceBase, toProxyAssetUrl('plato-stanford-edu', sourceBase, appOrigin));

  assert.equal(sourceBase, sourceUrl);
  assert.equal(
    new URL($('a').attr('href')!, $('base').attr('href')).href,
    `${appOrigin}/proxy/plato-stanford-edu/entries/#analog`,
  );
});

test('preserves a file-style document path and query while keeping relative asset resolution', () => {
  const appOrigin = 'https://annotation.mintcd.dev';
  const sourceUrl = 'https://example.com/articles/page.html?edition=2';
  const $ = cheerio.load('<html><head></head><body><a href="#section">Section</a></body></html>');
  const sourceBase = htmlSourceBase($, sourceUrl);

  installFrameSourceBase($, sourceBase, toProxyAssetUrl('example-com', sourceBase, appOrigin));

  assert.equal(sourceBase, sourceUrl);
  assert.equal(
    new URL($('a').attr('href')!, $('base').attr('href')).href,
    `${appOrigin}/proxy/example-com/articles/page.html?edition=2#section`,
  );
  assert.equal(new URL('image.png', sourceBase).href, 'https://example.com/articles/image.png');
});

test('respects an authored relative base and removes only its fragment', () => {
  const $ = cheerio.load('<html><head><base href="../other/?edition=2#ignored"></head></html>');

  assert.equal(
    htmlSourceBase($, 'https://example.com/articles/page.html?edition=1'),
    'https://example.com/other/?edition=2',
  );
});

test('keeps the requested query when restoring a canonical trailing slash', () => {
  const $ = cheerio.load('<html><head><link rel="canonical" href="https://example.com/articles/"></head></html>');

  assert.equal(
    storedHtmlSourceBase($, 'https://example.com/articles?edition=2'),
    'https://example.com/articles/?edition=2',
  );
});
