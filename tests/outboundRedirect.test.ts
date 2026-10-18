import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchOutboundUrl } from '../core/net/outboundFetch.ts';

test('reports the final response URL after an automatic trailing-slash redirect', async () => {
  const response = new Response('<html></html>', {
    headers: { 'content-type': 'text/html' },
  });
  Object.defineProperty(response, 'url', {
    value: 'https://plato.stanford.edu/entries/time/',
  });

  const result = await fetchOutboundUrl(
    'https://plato.stanford.edu/entries/time',
    { fetchImpl: async () => response },
  );

  assert.equal(result.finalUrl.href, 'https://plato.stanford.edu/entries/time/');
  assert.equal(
    new URL('./#Fata', new URL('.', result.finalUrl)).href,
    'https://plato.stanford.edu/entries/time/#Fata',
  );
});
