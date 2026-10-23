import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveExternalLinkHref } from '../core/frame/externalLinks.ts';
import { toAnnotatorPath } from '../core/utils/url.ts';

const appOrigin = 'https://annotation.mintcd.dev';
const sourcePageUrl = 'https://example.com/articles/current';

test('resolves relative annotated-page links against the source page', () => {
  assert.equal(
    resolveExternalLinkHref('next', {
      appOrigin,
      sourcePageUrl,
      documentBaseUrl: `${appOrigin}/example-com/articles/`,
      documentUrl: `${appOrigin}/frame/example-com/articles/current`,
    }),
    'https://example.com/articles/next',
  );
});

test('prefers an external document base over the canonical source page key', () => {
  assert.equal(
    resolveExternalLinkHref('next', {
      appOrigin,
      sourcePageUrl: 'https://example.com/articles',
      documentBaseUrl: 'https://example.com/articles/',
      documentUrl: `${appOrigin}/frame/example-com/articles`,
    }),
    'https://example.com/articles/next',
  );
});

test('preserves a directory path when resolving an anchored relative link', () => {
  assert.equal(
    resolveExternalLinkHref('./#Fata', {
      appOrigin,
      sourcePageUrl: 'https://plato.stanford.edu/entries/time',
      sourceBaseUrl: 'https://plato.stanford.edu/entries/time/',
      documentBaseUrl: `${appOrigin}/plato-stanford-edu/entries/time/`,
      documentUrl: `${appOrigin}/frame/plato-stanford-edu/entries/time`,
    }),
    'https://plato.stanford.edu/entries/time/#Fata',
  );
});

test('keeps the complete page path when rewriting Stanford anchor links', () => {
  const sourceUrl = 'https://plato.stanford.edu/entries/computing-history/';
  for (const href of ['#analog', './#analog', `${sourceUrl}#analog`]) {
    const resolved = resolveExternalLinkHref(href, {
      appOrigin,
      sourcePageUrl: sourceUrl.replace(/\/$/, ''),
      sourceBaseUrl: sourceUrl,
      documentBaseUrl: `${appOrigin}/plato-stanford-edu/entries/computing-history/`,
    });

    assert.equal(resolved, `${sourceUrl}#analog`);
    assert.equal(
      toAnnotatorPath('plato-stanford-edu', resolved!),
      '/plato-stanford-edu/entries/computing-history/#analog',
    );
  }
});

test('preserves the page path and query for fragment-only links without source metadata', () => {
  assert.equal(
    resolveExternalLinkHref('#section%202', {
      appOrigin,
      sourcePageUrl: 'https://example.com/articles/current?version=2',
      documentBaseUrl: `${appOrigin}/example-com/articles/current?version=2`,
    }),
    'https://example.com/articles/current?version=2#section%202',
  );
});

test('resolves fragment-only links against an authored source base', () => {
  assert.equal(
    resolveExternalLinkHref('#section', {
      appOrigin,
      sourcePageUrl,
      sourceBaseUrl: 'https://example.com/other/?version=2',
    }),
    'https://example.com/other/?version=2#section',
  );
});

test('recovers source navigation when a script sets an absolute URL using the proxy base', () => {
  assert.equal(
    resolveExternalLinkHref(`${appOrigin}/proxy/example-com/articles/current?edition=2#section`, {
      appOrigin,
      sourcePageUrl,
      sourceBaseUrl: `${sourcePageUrl}?edition=2`,
      documentBaseUrl: `${appOrigin}/proxy/example-com/articles/current?edition=2`,
      documentUrl: `${appOrigin}/frame/example-com/articles/current`,
    }),
    'https://example.com/articles/current?edition=2#section',
  );
});

test('does not map proxy URLs for another site or an unrelated app document', () => {
  assert.equal(
    resolveExternalLinkHref(`${appOrigin}/proxy/another-com/page`, {
      appOrigin,
      sourcePageUrl,
      documentUrl: `${appOrigin}/frame/example-com/articles/current`,
    }),
    null,
  );
  assert.equal(
    resolveExternalLinkHref(`${appOrigin}/proxy/example-com/page`, {
      appOrigin,
      sourcePageUrl,
      documentUrl: `${appOrigin}/dashboard`,
    }),
    null,
  );
});

test('resolves an empty fragment to the top of the source document', () => {
  assert.equal(resolveExternalLinkHref('#', { appOrigin, sourcePageUrl }), `${sourcePageUrl}#`);
});

test('ignores app-internal, javascript, and non-web links', () => {
  assert.equal(
    resolveExternalLinkHref(`${appOrigin}/dashboard`, { appOrigin, sourcePageUrl }),
    null,
  );
  assert.equal(resolveExternalLinkHref('javascript:void(0)', { appOrigin, sourcePageUrl }), null);
  assert.equal(resolveExternalLinkHref('mailto:user@example.com', { appOrigin, sourcePageUrl }), null);
});
