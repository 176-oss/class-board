import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayTimetable } from '../js/core/timetable.js';
import { board, kst, PERIODS } from './_board.js';

const b = board();
const states = (r) => Object.fromEntries(r.rows.map((x) => [x.kind === 'class' ? x.no : x.label, x.state]));

test('자정 직전·직후: 금요일 밤은 모두 past, 토요일 0시는 주말', () => {
  const fri = todayTimetable(b, kst(2026, 11, 13, 23, 59));
  assert.equal(fri.status, 'class');
  assert.ok(fri.rows.length > 0 && fri.rows.every((x) => x.state === 'past'));
  assert.deepEqual(todayTimetable(b, kst(2026, 11, 14, 0, 0)), { status: 'weekend', label: '주말', rows: [] });
});

test('교시 경계 09:44 / 09:45', () => {
  const a = todayTimetable(b, kst(2026, 11, 10, 9, 44));
  assert.equal(states(a)[1], 'now');
  assert.equal(states(a)[2], 'future');
  const c = todayTimetable(b, kst(2026, 11, 10, 9, 45));
  assert.equal(states(c)[1], 'past');
  assert.equal(states(c)[2], 'next');
  assert.ok(!c.rows.some((x) => x.state === 'now'));
});

test('쉬는 시간 09:50', () => {
  const s = states(todayTimetable(b, kst(2026, 11, 10, 9, 50)));
  assert.equal(s[1], 'past');
  assert.equal(s[2], 'next');
});

test('첫 교시 전 08:30 / 끝난 뒤 15:10', () => {
  const s = states(todayTimetable(b, kst(2026, 11, 10, 8, 30)));
  assert.equal(s[1], 'next');
  assert.equal(Object.values(s).filter((v) => v === 'next').length, 1);
  const e = todayTimetable(b, kst(2026, 11, 10, 15, 10));
  assert.ok(e.rows.every((x) => x.state === 'past'));
});

test('점심 12:40: 점심 행 now, 5교시 next', () => {
  const s = states(todayTimetable(b, kst(2026, 11, 10, 12, 40)));
  assert.equal(s['점심'], 'now');
  assert.equal(s[5], 'next');
});

test('행 모양: class 는 n교시, break 는 no null', () => {
  const r = todayTimetable(b, kst(2026, 11, 10, 8, 0));
  assert.deepEqual(r.rows[0], { kind: 'class', no: 1, label: '1교시', start: '09:00', end: '09:45', subject: 'tue-국어', note: '', state: 'next' });
  assert.deepEqual(r.rows[4], { kind: 'break', no: null, label: '점심', start: '12:30', end: '13:20', subject: '', note: '', state: 'future' });
});

test('공휴일', () => {
  const h = board({ noClass: [{ startDate: '2026-11-17', endDate: '2026-11-17', label: '개교기념일' }] });
  assert.deepEqual(todayTimetable(h, kst(2026, 11, 17, 10, 0)), { status: 'noClass', label: '개교기념일', rows: [] });
  assert.equal(todayTimetable(h, kst(2026, 11, 18, 10, 0)).status, 'class');
});

test('방학: 기간 안, 마지막 날이 일요일이어도 방학이 먼저, 끝난 뒤 수업', () => {
  const v = board({ noClass: [{ startDate: '2026-12-24', endDate: '2027-02-28', label: '겨울방학' }] });
  assert.deepEqual(todayTimetable(v, kst(2027, 1, 5, 10, 0)), { status: 'noClass', label: '겨울방학', rows: [] });
  assert.deepEqual(todayTimetable(v, kst(2027, 2, 28, 10, 0)), { status: 'noClass', label: '겨울방학', rows: [] });
  assert.equal(todayTimetable(v, kst(2027, 3, 2, 10, 0)).status, 'class');
  assert.equal(todayTimetable(v, kst(2026, 12, 24, 0, 0)).status, 'noClass');
  assert.equal(todayTimetable(v, kst(2026, 12, 23, 23, 59)).status, 'class');
});

function withOverride(ov) {
  const raw = board();
  raw.timetable[0].overrides = [ov];
  return board({ timetable: raw.timetable });
}

test('overrides 병합 (replaceAll false)', () => {
  const o = withOverride({ date: '2026-11-12', replaceAll: false, items: [{ period: 3, subject: '체육', note: '강당' }, { period: 5, subject: '' }] });
  const rows = todayTimetable(o, kst(2026, 11, 12, 8, 0)).rows.filter((x) => x.kind === 'class');
  assert.deepEqual(rows.map((x) => [x.no, x.subject, x.note]), [
    [1, 'thu-국어', ''], [2, 'thu-수학', ''], [3, '체육', '강당'], [4, 'thu-과학', ''], [6, 'thu-음악', ''],
  ]);
  assert.equal(todayTimetable(o, kst(2026, 11, 11, 8, 0)).rows.find((x) => x.no === 3).subject, 'wed-사회');
});

test('replaceAll: class 행은 1교시만, 점심 행은 남음', () => {
  const o = withOverride({ date: '2026-11-12', replaceAll: true, items: [{ period: 1, subject: '현장체험' }] });
  const r = todayTimetable(o, kst(2026, 11, 12, 8, 0));
  assert.deepEqual(r.rows.map((x) => x.label), ['1교시', '점심']);
  assert.equal(r.rows[0].subject, '현장체험');
});

test('overrides 로 모든 교시가 빠지면 none', () => {
  const o = withOverride({ date: '2026-11-12', replaceAll: true, items: [] });
  assert.deepEqual(todayTimetable(o, kst(2026, 11, 12, 8, 0)), { status: 'none', label: '', rows: [] });
});

test('버전: effectiveFrom 이 오늘 이하인 것 중 가장 늦은 것', () => {
  const raw = board();
  const v2 = { ...structuredClone(raw.timetable[0]), effectiveFrom: '2026-11-11' };
  v2.week.tue = [{ period: 1, subject: '둘째' }];
  v2.week.wed = [{ period: 1, subject: '둘째' }];
  const v = board({ timetable: [{ ...raw.timetable[0], effectiveFrom: '2026-09-01' }, v2] });
  assert.equal(todayTimetable(v, kst(2026, 11, 10, 8, 0)).rows[0].subject, 'tue-국어');
  assert.equal(todayTimetable(v, kst(2026, 11, 11, 8, 0)).rows[0].subject, '둘째');
  assert.equal(todayTimetable(v, kst(2026, 8, 31, 8, 0)).status, 'none');
});

test('periodsByDay: 그 요일 교시표를 쓴다', () => {
  const raw = board();
  raw.timetable[0].periodsByDay = { wed: PERIODS.slice(0, 3) };
  raw.timetable[0].week.wed = raw.timetable[0].week.wed.slice(0, 3);
  const v = board({ timetable: raw.timetable });
  assert.equal(todayTimetable(v, kst(2026, 11, 11, 8, 0)).rows.length, 3);
  assert.equal(todayTimetable(v, kst(2026, 11, 10, 8, 0)).rows.length, 7);
});

test('인자를 바꾸지 않는다', () => {
  const copy = structuredClone(b);
  todayTimetable(b, kst(2026, 11, 10, 9, 50));
  assert.deepEqual(b, copy);
});
