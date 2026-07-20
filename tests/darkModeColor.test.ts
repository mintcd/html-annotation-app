import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contrastRatio,
  parseCssColor,
  relativeLuminance,
  retargetColorForBackground,
} from '../core/frame/darkMode.ts';

function color(value: string) {
  const parsed = parseCssColor(value);
  assert.ok(parsed);
  return parsed;
}

test('computes WCAG relative luminance and contrast', () => {
  assert.equal(relativeLuminance(color('#000000')), 0);
  assert.equal(relativeLuminance(color('#ffffff')), 1);
  assert.equal(Math.round(contrastRatio(color('#000000'), color('#ffffff'))), 21);
});

test('moves dark text to the light side of a dark target background', () => {
  const sourceBackground = color('#ffffff');
  const targetBackground = color('#0f172a');
  const mapped = retargetColorForBackground(
    color('#111827'),
    sourceBackground,
    targetBackground,
    'text',
  );

  assert.ok(relativeLuminance(mapped) > relativeLuminance(targetBackground));
  assert.ok(contrastRatio(mapped, targetBackground) >= 10);
});

test('keeps low-contrast surfaces close to the dark target background', () => {
  const sourceBackground = color('#f7f8fb');
  const targetBackground = color('#0f172a');
  const sourceSurface = color('#ffffff');
  const mapped = retargetColorForBackground(
    sourceSurface,
    sourceBackground,
    targetBackground,
    'surface',
  );

  assert.ok(relativeLuminance(mapped) > relativeLuminance(targetBackground));
  assert.ok(contrastRatio(mapped, targetBackground) < 1.5);
});
