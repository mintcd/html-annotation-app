import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldAdoptPreparedPageTitle,
  storedPageTitle,
} from '../core/annotation/session/title.ts';

test('normalizes stored page titles before comparison', () => {
  assert.equal(storedPageTitle('  Custom title  '), 'Custom title');
  assert.equal(storedPageTitle(null), '');
  assert.equal(storedPageTitle(undefined), '');
});

test('adopts iframe title only when no different stored title exists', () => {
  assert.equal(shouldAdoptPreparedPageTitle('', 'Iframe title'), true);
  assert.equal(shouldAdoptPreparedPageTitle('Iframe title', 'Iframe title'), true);
  assert.equal(shouldAdoptPreparedPageTitle('Custom title', 'Iframe title'), false);
  assert.equal(shouldAdoptPreparedPageTitle('Custom title', ''), false);
});
