import assert from 'node:assert/strict';
import test from 'node:test';

import * as cheerio from 'cheerio';

import { FRAME_SOURCE_BASE_META_NAME, resolveExternalLinkHref } from '../core/frame/externalLinks.ts';
import { installFrameSourceBase, storedHtmlSourceBase } from '../core/frame/sourceBase.ts';

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

test('keeps an external source base when the iframe document base is app-scoped', () => {
  const appOrigin = 'http://localhost:5001';
  const $ = cheerio.load('<html><head></head><body><a href="./#Fata">Fatalism</a></body></html>');

  installFrameSourceBase(
    $,
    sourceDirectory,
    `${appOrigin}/plato-stanford-edu/entries/time/`,
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
