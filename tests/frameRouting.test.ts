import assert from 'node:assert/strict';
import test from 'node:test';

import { frameRequestRewrite } from '../core/frame/routing.ts';

const appOrigin = 'https://annotation.mintcd.dev';
const site = 'plato-stanford-edu';
const frameReferer = `${appOrigin}/frame/${site}/entries/computing-history/?edition=2`;

function rewrite(
  pathname: string,
  headers: Record<string, string> = {},
  method = 'GET',
): string | null {
  return frameRequestRewrite({
    url: `${appOrigin}${pathname}`,
    method,
    headers: new Headers(headers),
  });
}

test('routes root-relative resources using their frame referer', () => {
  assert.equal(
    rewrite('/images/analog.svg?v=2', { referer: frameReferer, 'sec-fetch-dest': 'image' }),
    `/proxy/${site}/images/analog.svg?v=2`,
  );
});

test('routes nested CSS dependencies using their proxy stylesheet referer', () => {
  assert.equal(
    rewrite('/fonts/body.woff2', {
      referer: `${appOrigin}/proxy/${site}/styles/site.css`,
      'sec-fetch-dest': 'font',
    }),
    `/proxy/${site}/fonts/body.woff2`,
  );
});

test('retains legacy site-prefixed resource resolution for saved frames', () => {
  assert.equal(
    rewrite(`/${site}/entries/image.png?size=2`, { referer: frameReferer }),
    `/proxy/${site}/entries/image.png?size=2`,
  );
  assert.equal(
    rewrite(`/${site}/`, { referer: frameReferer }),
    `/proxy/${site}/`,
  );
});

test('recognizes only exact rooted frame and proxy referer routes', () => {
  for (const pathname of [
    `/other/frame/${site}/page`,
    `/other/proxy/${site}/page`,
    `/frames/${site}/page`,
    `/proxying/${site}/page`,
    '/frame',
    '/proxy/',
    '/frame/site.invalid/page',
  ]) {
    assert.equal(rewrite('/image.png', { referer: `${appOrigin}${pathname}` }), null, pathname);
  }
});

test('rejects external and malformed frame referers', () => {
  for (const referer of [
    `https://external.example/frame/${site}/page`,
    `https://annotation.mintcd.dev.external.example/frame/${site}/page`,
    `http://annotation.mintcd.dev/frame/${site}/page`,
    `/frame/${site}/page`,
    'not a URL',
  ]) {
    assert.equal(rewrite('/image.png', { referer }), null, referer);
  }
});

test('keeps simultaneous sites independent of the former proxy cookie', () => {
  const headers = { cookie: '__proxy_site=wrong-site', 'sec-fetch-dest': 'image' };
  assert.equal(
    rewrite('/image.png', { ...headers, referer: frameReferer }),
    `/proxy/${site}/image.png`,
  );
  assert.equal(
    rewrite('/image.png', { ...headers, referer: `${appOrigin}/frame/another-site/article` }),
    '/proxy/another-site/image.png',
  );
  assert.equal(rewrite('/image.png', headers), null);
});

test('uses fetch destination before falling back to HTML accept headers', () => {
  assert.equal(
    rewrite('/image.png', { referer: frameReferer, accept: 'text/html', 'sec-fetch-dest': 'image' }),
    `/proxy/${site}/image.png`,
  );
  assert.equal(
    rewrite('/data.json', { referer: frameReferer, accept: 'application/json', 'sec-fetch-dest': 'empty' }),
    `/proxy/${site}/data.json`,
  );
  assert.equal(
    rewrite('/article', { referer: frameReferer, accept: '*/*', 'sec-fetch-dest': 'document' }),
    null,
  );
  for (const accept of ['text/html', 'application/xhtml+xml']) {
    assert.equal(rewrite('/article', { referer: frameReferer, accept }), null);
  }
});

test('preserves iframe navigation paths, trailing slashes, and queries', () => {
  assert.equal(
    rewrite(`/${site}/entries/computing-history/?edition=2&view=full`, { 'sec-fetch-dest': 'iframe' }),
    `/frame/${site}/entries/computing-history/?edition=2&view=full`,
  );
  assert.equal(rewrite(`/${site}/`, { 'sec-fetch-dest': 'iframe' }), `/frame/${site}/`);
  assert.equal(rewrite(`/${site}`, { 'sec-fetch-dest': 'iframe' }), `/frame/${site}`);
  assert.equal(rewrite('/', { 'sec-fetch-dest': 'iframe' }), null);
});

test('sends iframe navigations against the proxy base to the frame handler', () => {
  assert.equal(
    rewrite(`/proxy/${site}/entries/computing-history/?edition=2`, { 'sec-fetch-dest': 'iframe' }),
    `/frame/${site}/entries/computing-history/?edition=2`,
  );
  assert.equal(rewrite('/proxy', { 'sec-fetch-dest': 'iframe' }), null);
  assert.equal(rewrite('/proxy/', { 'sec-fetch-dest': 'iframe' }), null);
});

test('leaves explicit frame and proxy requests unchanged to prevent rewrite loops', () => {
  for (const pathname of [`/frame/${site}/page`, `/proxy/${site}/image.png`]) {
    assert.equal(rewrite(pathname, { referer: frameReferer, 'sec-fetch-dest': 'image' }), null);
  }
  assert.equal(rewrite(`/frame/${site}/page`, { 'sec-fetch-dest': 'iframe' }), null);
});

test('protects app APIs, framework resources, and static routes', () => {
  for (const pathname of [
    '/api', '/api/sync', '/_next', '/_next/static/app.js',
    '/_vinext', '/_vinext/client.js', '/favicon.ico', '/robots.txt',
  ]) {
    for (const destination of ['image', 'iframe']) {
      assert.equal(
        rewrite(pathname, { referer: frameReferer, 'sec-fetch-dest': destination }),
        null,
        `${destination}: ${pathname}`,
      );
    }
  }
  assert.equal(rewrite('/apiary/picture.png', { referer: frameReferer }), `/proxy/${site}/apiary/picture.png`);
});

test('limits rewriting to safe resource request methods', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.equal(rewrite('/image.png', { referer: frameReferer }, method), `/proxy/${site}/image.png`);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(rewrite('/image.png', { referer: frameReferer }, method), null);
    assert.equal(rewrite(`/${site}/page`, { 'sec-fetch-dest': 'iframe' }, method), null);
  }
});

test('does not activate iframe routing from a source query parameter', () => {
  assert.equal(rewrite(`/${site}/article?frame=1`), null);
});
