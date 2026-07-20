import assert from 'node:assert/strict';
import test from 'node:test';

import {
  sanitizeAnnotationHref,
  sanitizeAnnotationHtml,
} from '../core/annotation/dom/sanitizeHtml.ts';

test('keeps only safe excerpt elements and strips attributes by default', () => {
  assert.equal(
    sanitizeAnnotationHtml('<p onclick="x()">Hello <strong data-testid="x">world</strong></p>'),
    '<p>Hello <strong>world</strong></p>',
  );
});

test('removes dangerous elements and their contents', () => {
  assert.equal(
    sanitizeAnnotationHtml('A<script><strong>alert</strong></script><style>b{}</style>B'),
    'AB',
  );
});

test('drops media and unwraps unknown elements', () => {
  assert.equal(
    sanitizeAnnotationHtml('<div><span style="color:red">Safe</span><custom> text</custom><img src=x></div>'),
    '<span>Safe</span> text',
  );
});

test('allows only safe link targets and attributes', () => {
  assert.equal(
    sanitizeAnnotationHtml(
      '<a href="javascript:alert(1)" onclick="x()" title="bad">bad</a>'
      + '<a href="https://example.com/a?b=1&c=2" target="_blank">ok</a>',
    ),
    '<a title="bad">bad</a><a href="https://example.com/a?b=1&amp;c=2">ok</a>',
  );
});

test('preserves existing entities without double escaping text', () => {
  assert.equal(
    sanitizeAnnotationHtml('Tom &amp; Jerry < nope'),
    'Tom &amp; Jerry &lt; nope',
  );
});

test('validates annotation href protocols', () => {
  assert.equal(sanitizeAnnotationHref('https://Example.com/a'), 'https://example.com/a');
  assert.equal(sanitizeAnnotationHref('#local-section'), '#local-section');
  assert.equal(sanitizeAnnotationHref('mailto:user@example.com'), null);
  assert.equal(sanitizeAnnotationHref('https://user:pass@example.com'), null);
  assert.equal(sanitizeAnnotationHref('java\u0000script:alert(1)'), null);
});
