import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, contrastRatio, checkPalette } from '../js/core/palette.js';

const r2 = (x) => Math.round(x * 100) / 100;

test('contrastRatio', () => {
  assert.equal(contrastRatio('#FFFFFF', '#000000'), 21);
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(r2(contrastRatio('#C98A1B', '#FFFFFF')), 2.94);
  assert.throws(() => contrastRatio('#FFF', '#000000'));
});

test('checkPalette: 4개 묶음 모두 ok, 11쌍', () => {
  for (const [name, p] of Object.entries(PALETTES)) {
    const r = checkPalette(p);
    assert.equal(r.ok, true, name);
    assert.equal(r.pairs.length, 11);
  }
  assert.equal(checkPalette({ ...PALETTES.honey, muted: '#C98A1B' }).ok, false);
});

// 계약 4-2 표 값이 실제 계산과 맞는지 (소수 둘째 자리).
const TABLE = {
  honey: [13.32, 15.20, 5.34, 6.09, 5.19, 5.92, 7.48, 8.54, 5.76, 6.57, 5.16],
  brown: [8.54, 10.89, 7.48, 9.55, 5.53, 7.05, 8.54, 10.89, 5.02, 6.40, 5.16],
  sand: [13.18, 14.36, 5.29, 5.76, 6.17, 6.72, 7.41, 8.07, 5.70, 6.21, 5.16],
  night: [15.87, 13.32, 10.01, 8.41, 9.29, 7.80, 15.87, 13.32, 8.84, 7.42, 6.15],
};

test('계약 4-2 대비 표와 계산이 같다', () => {
  for (const [name, want] of Object.entries(TABLE)) {
    assert.deepEqual(checkPalette(PALETTES[name]).pairs.map((x) => r2(x.ratio)), want, name);
  }
});
