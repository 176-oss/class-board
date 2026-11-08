import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDelay, backoffDelay, connectRetryDelay, staleness, clockSkew, isDawnReload } from '../js/core/net.js';
import { seoulNow } from '../js/core/time.js';
import { kst } from './_board.js';

test('startDelay', () => {
  assert.equal(startDelay(true, 0.5), 30000);
  assert.equal(startDelay(false, 0.5), 2500);
  assert.equal(startDelay(true, 0), 0);
});

test('backoffDelay', () => {
  assert.deepEqual([[1, 0.5], [1, 0], [2, 0.5], [3, 0.5], [4, 1], [9, 0.5]].map(([a, r]) => backoffDelay(a, r)),
    [60000, 48000, 120000, 300000, 600000, 600000]);
});

test('connectRetryDelay', () => {
  assert.deepEqual([1, 2, 3, 7].map(connectRetryDelay), [30000, 60000, 300000, 300000]);
});

test('staleness', () => {
  const now = kst(2026, 11, 10, 14, 30);
  assert.deepEqual(staleness(null, now), { level: 'ok', text: '' });
  assert.deepEqual(staleness(now - 600000, now), { level: 'ok', text: '' });
  assert.deepEqual(staleness(now - 600001, now), { level: 'stale', text: '마지막 갱신 ' + seoulNow(now - 600001).time });
  assert.equal(staleness(now - 600001, now).text, '마지막 갱신 14:19');
  assert.deepEqual(staleness(now - 86400001, now), { level: 'days', text: '며칠째 갱신되지 않음' });
});

test('clockSkew', () => {
  const now = Date.UTC(2026, 10, 10, 5, 0, 0);
  assert.equal(clockSkew(new Date(now + 300000).toISOString(), now), false);
  assert.equal(clockSkew(new Date(now + 300001).toISOString(), now), true);
  assert.equal(clockSkew('x', now), false);
});

test('isDawnReload', () => {
  const at = (h, m) => kst(2026, 11, 10, h, m);
  assert.deepEqual([[2, 59], [3, 0], [4, 59], [5, 0]].map(([h, m]) => isDawnReload(at(h, m), '2026-11-09')), [false, true, true, false]);
  assert.equal(isDawnReload(at(3, 30), '2026-11-10'), false);
});
