import assert from 'node:assert/strict';
import test from 'node:test';

import { navigateToFrameFragment, sameDocumentFragment, scrollToFrameFragment } from '../core/frame/fragments.ts';

test('updates the parent anchor and scrolls the current frame without navigating away', () => {
  let requestedId = '';
  let scrolled = false;
  const historyUpdates: unknown[][] = [];
  const doc = {
    getElementById(id: string) {
      requestedId = id;
      return { scrollIntoView() { scrolled = true; } };
    },
  } as unknown as Document;
  const appWindow = {
    location: {
      href: 'https://annotation.mintcd.dev/plato-stanford-edu/entries/computing-history?edition=2#previous',
    },
    history: {
      pushState(...args: unknown[]) { historyUpdates.push(args); },
    },
  } as unknown as Pick<Window, 'location' | 'history'>;

  assert.equal(
    navigateToFrameFragment(
      doc,
      'https://plato.stanford.edu/entries/computing-history/?edition=2#analog',
      'https://plato.stanford.edu/entries/computing-history?edition=2',
      appWindow,
    ),
    true,
  );
  assert.deepEqual(historyUpdates, [
    [null, '', '/plato-stanford-edu/entries/computing-history?edition=2#analog'],
  ]);
  assert.equal(requestedId, 'analog');
  assert.equal(scrolled, true);

  assert.equal(
    navigateToFrameFragment(
      doc,
      'https://plato.stanford.edu/entries/time/#analog',
      'https://plato.stanford.edu/entries/computing-history?edition=2',
      appWindow,
    ),
    false,
  );
  assert.equal(historyUpdates.length, 1);
});

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

test('scrolls to the top for an explicit empty fragment without leaving the frame', () => {
  let scrolledToTop = false;
  const doc = {
    documentElement: { scrollIntoView() { scrolledToTop = true; } },
  } as unknown as Document;

  assert.equal(
    sameDocumentFragment('https://example.com/page#', 'https://example.com/page'),
    '#',
  );
  assert.equal(
    sameDocumentFragment('https://example.com/page', 'https://example.com/page'),
    null,
  );
  assert.equal(scrollToFrameFragment(doc, '#'), true);
  assert.equal(scrolledToTop, true);
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
