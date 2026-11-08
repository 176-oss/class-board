import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidFileId, randomId, boardFileName, imageFileName, historyFileName, parseHistoryName } from '../js/core/ids.js';
import { phoneWarning } from '../js/core/privacy.js';

test('isValidFileId', () => {
  const cases = ['a'.repeat(19), 'a'.repeat(20), 'a'.repeat(80), 'a'.repeat(81), '../abcdefghijklmnopqrstu', 'abcdefghij klmnopqrstu', 123];
  assert.deepEqual(cases.map(isValidFileId), [false, true, true, false, false, false, false]);
  assert.equal(isValidFileId('<script>abcdefghijklmnopq'), false);
});

test('randomId 와 파일 이름', () => {
  assert.match(randomId(), /^[a-z0-9]{12}$/);
  assert.match(randomId(10), /^[a-z0-9]{10}$/);
  assert.notEqual(randomId(), randomId());
  assert.match(boardFileName(), /^board-[a-z0-9]{12}\.json$/);
  assert.match(imageFileName(), /^img-[a-z0-9]{12}\.jpg$/);
});

test('이력 이름 만들고 읽기', () => {
  const id = 'Ab_-0123456789abcdefgh';
  assert.equal(historyFileName(id, 7), `classboard-hist-${id}-7.json`);
  assert.deepEqual(parseHistoryName(historyFileName(id, 12)), { boardId: id, rev: 12 });
  assert.equal(parseHistoryName('sgb-data.json'), null);
  assert.equal(parseHistoryName('classboard-hist-short-3.json'), null);
  assert.equal(parseHistoryName(`classboard-hist-${id}-0.json`), null);
  assert.equal(parseHistoryName(null), null);
});

test('phoneWarning: 찾음', () => {
  for (const s of ['010-1234-5678', '01012345678', '010 1234 5678', '02-123-4567']) {
    assert.deepEqual(phoneWarning(`연락: ${s} 로`), [s], s);
  }
});

test('phoneWarning: 날짜·번호는 찾지 않음', () => {
  for (const s of ['2026-11-08', '3학년 5반 12번', '1234-5678', '1010-1234-56789']) assert.deepEqual(phoneWarning(s), [], s);
});
