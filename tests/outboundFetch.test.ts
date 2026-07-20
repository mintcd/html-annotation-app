import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OutboundFetchError,
  fetchOutboundUrl,
  readResponseArrayBuffer,
  validateOutboundUrl,
} from '../core/net/outboundFetch.ts';

test('validates ordinary public http and https URLs', () => {
  assert.equal(validateOutboundUrl('https://example.com/path').href, 'https://example.com/path');
  assert.equal(validateOutboundUrl('http://example.com/').href, 'http://example.com/');
});

test('rejects unsupported protocols and URL credentials', () => {
  assert.throws(
    () => validateOutboundUrl('file:///etc/passwd'),
    OutboundFetchError,
  );
  assert.throws(
    () => validateOutboundUrl('https://user:pass@example.com/'),
    /credentials/,
  );
});

test('rejects obvious local and infrastructure hostnames', () => {
  for (const rawUrl of [
    'https://localhost/',
    'https://app.localhost/',
    'https://metadata/',
    'https://metadata.google.internal/',
    'https://router.lan/',
    'https://service.internal/',
  ]) {
    assert.throws(() => validateOutboundUrl(rawUrl), /host is not allowed/);
  }
});

test('rejects private and reserved literal IP addresses', () => {
  for (const rawUrl of [
    'http://10.0.0.1/',
    'http://127.1/',
    'http://0x7f000001/',
    'http://2130706433/',
    'http://169.254.169.254/',
    'http://172.16.0.1/',
    'http://192.168.1.1/',
    'http://[::1]/',
    'http://[fc00::1]/',
    'http://[fe80::1]/',
    'http://[::ffff:127.0.0.1]/',
  ]) {
    assert.throws(() => validateOutboundUrl(rawUrl), /host is not allowed/);
  }
});

test('revalidates redirect targets before following them', async () => {
  const calls: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    calls.push(String(input));
    return new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/admin' },
    });
  };

  await assert.rejects(
    () => fetchOutboundUrl('https://example.com/', { fetchImpl }),
    /host is not allowed/,
  );
  assert.deepEqual(calls, ['https://example.com/']);
});

test('enforces allowed content types on successful responses', async () => {
  await assert.rejects(
    () => fetchOutboundUrl('https://example.com/', {
      allowedContentTypes: ['image/*'],
      fetchImpl: async () => new Response('<html></html>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    }),
    /unsupported content type/,
  );
});

test('enforces content-length and streamed body size caps', async () => {
  await assert.rejects(
    () => fetchOutboundUrl('https://example.com/file', {
      maxBytes: 2,
      fetchImpl: async () => new Response('abcd', {
        headers: { 'content-length': '4' },
      }),
    }),
    /too large/,
  );

  await assert.rejects(
    () => readResponseArrayBuffer(new Response('abcd'), 2),
    /too large/,
  );
});
