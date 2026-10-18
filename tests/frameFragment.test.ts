import assert from 'node:assert/strict';
import test from 'node:test';

import { sameDocumentFragment, scrollToFrameFragment } from '../core/frame/fragments.ts';

test('scrolls the iframe document to a decoded parent URL fragment', () => {
  let requestedId = '';
  let scrollOptions: ScrollIntoViewOptions | undefined;
  const target = {
    scrollIntoView(options?: ScrollIntoViewOptions) {
      scrollOptions = options;
    },
  } as HTMLElement;
  const doc = {
    getElementById(id: string) {
      requestedId = id;
      return target;
    },
    getElementsByName() {
      return { item: () => null };
    },
  } as unknown as Document;

  assert.equal(scrollToFrameFragment(doc, '#Fata%20Section'), true);
  assert.equal(requestedId, 'Fata Section');
  assert.deepEqual(scrollOptions, { behavior: 'auto', block: 'start' });
});

test('does not scroll when the fragment has no matching target', () => {
  const doc = {
    getElementById: () => null,
    getElementsByName: () => ({ item: () => null }),
  } as unknown as Document;

  assert.equal(scrollToFrameFragment(doc, '#Missing'), false);
  assert.equal(scrollToFrameFragment(doc, ''), false);
});

test('recognizes a trailing-slash variant as a same-document fragment', () => {
  assert.equal(
    sameDocumentFragment(
      'https://plato.stanford.edu/entries/time/#Fata',
      'https://plato.stanford.edu/entries/time',
    ),
    '#Fata',
  );
});

test('does not treat a fragment on another page as same-document navigation', () => {
  assert.equal(
    sameDocumentFragment(
      'https://plato.stanford.edu/entries/persistence/#Fata',
      'https://plato.stanford.edu/entries/time',
    ),
    null,
  );
});
