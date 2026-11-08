import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateBoard } from '../js/core/schema.js';

const load = (name) => validateBoard(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const len = (s) => [...s].length;

test('정상 예시는 검사를 통과한다', () => {
  assert.equal(load('board-sample.json').ok, true);
});

test('최악 데이터는 16절 10번 분량이고 검사를 통과한다', () => {
  const r = load('board-worst.json');
  assert.equal(r.ok, true);
  const b = r.board;
  assert.equal(b.notices.filter((n) => n.endDate === null).length, 50);
  assert.ok(b.notices.every((n) => len(n.title) === 40 && len(n.body) === 500));
  assert.equal(b.timetable[0].periods.filter((p) => p.kind === 'class').length, 10);
  assert.equal(b.events.length, 20);
  assert.equal(b.duty.zones.length, 12);
});
