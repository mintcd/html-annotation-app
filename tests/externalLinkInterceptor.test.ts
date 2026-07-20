import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveExternalLinkHref } from '../core/frame/externalLinks.ts';

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

test('ignores app-internal, fragment, javascript, and non-web links', () => {
  assert.equal(
    resolveExternalLinkHref(`${appOrigin}/dashboard`, { appOrigin, sourcePageUrl }),
    null,
  );
  assert.equal(resolveExternalLinkHref('#section', { appOrigin, sourcePageUrl }), null);
  assert.equal(resolveExternalLinkHref('javascript:void(0)', { appOrigin, sourcePageUrl }), null);
  assert.equal(resolveExternalLinkHref('mailto:user@example.com', { appOrigin, sourcePageUrl }), null);
});
