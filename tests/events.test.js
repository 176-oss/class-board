import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventsView } from '../js/core/events.js';
import { board } from './_board.js';

const ev = (id, date, extra) => ({ id, date, title: `행사 ${id}`, ...extra });
const view = (events, today, limit) => eventsView(board({ events }), today, limit);

test('D-n, upcoming', () => {
  const [e] = view([ev('a', '2026-11-20')], '2026-11-10').items;
  assert.equal(e.dday, 'D-10');
  assert.equal(e.state, 'upcoming');
});

test('당일과 기간 중은 D-Day, ongoing', () => {
  const r = view([ev('a', '2026-11-10'), ev('b', '2026-11-09', { endDate: '2026-11-11' })], '2026-11-10').items;
  assert.deepEqual(r.map((x) => [x.id, x.dday, x.state]), [['b', 'D-Day', 'ongoing'], ['a', 'D-Day', 'ongoing']]);
});

test('끝난 일정은 숨김', () => {
  assert.deepEqual(view([ev('a', '2026-11-09'), ev('b', '2026-11-01', { endDate: '2026-11-09' })], '2026-11-10').items, []);
});

test('해 넘김', () => {
  assert.equal(view([ev('a', '2027-01-01')], '2026-12-31').items[0].dday, 'D-1');
});

test('정렬 date, time(빈 값 먼저), id, limit 넘으면 more', () => {
  const r = view([
    ev('c', '2026-11-12', { time: '09:00' }), ev('b', '2026-11-12'), ev('a', '2026-11-12', { time: '09:00' }),
    ev('d', '2026-11-11'), ev('e', '2026-11-20'), ev('f', '2026-11-21'),
  ], '2026-11-10');
  assert.deepEqual(r.items.map((x) => x.id), ['d', 'b', 'a', 'c', 'e']);
  assert.equal(r.more, 1);
  assert.equal(view([ev('a', '2026-11-12')], '2026-11-10', 5).more, 0);
});

test('항목 모양', () => {
  assert.deepEqual(view([ev('a', '2026-11-12', { note: '운동장' })], '2026-11-10').items[0],
    { id: 'a', title: '행사 a', date: '2026-11-12', endDate: null, time: '', note: '운동장', dday: 'D-2', state: 'upcoming' });
});
