process.env.TZ = 'UTC';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seoulNow, seoulIso, isDate, isTime, addDays, daysBetween, weekdayOf, mondayOf } from '../js/core/time.js';
import { todayTimetable } from '../js/core/timetable.js';
import { activeNotices } from '../js/core/notices.js';
import { dutyFor } from '../js/core/duty.js';
import { isDawnReload, staleness } from '../js/core/net.js';
import { board, kst } from './_board.js';

const pick = ({ date, time, weekday }) => ({ date, time, weekday });

test('seoulNow: 자정 직전·직후', () => {
  assert.deepEqual(pick(seoulNow(Date.UTC(2026, 10, 13, 14, 59, 59))), { date: '2026-11-13', time: '23:59', weekday: 'fri' });
  assert.equal(seoulNow(Date.UTC(2026, 10, 13, 14, 59, 59)).seconds, 59);
  assert.deepEqual(pick(seoulNow(Date.UTC(2026, 10, 13, 15, 0, 0))), { date: '2026-11-14', time: '00:00', weekday: 'sat' });
});

test('seoulIso', () => {
  assert.equal(seoulIso(Date.UTC(2026, 10, 8, 10, 30, 0)), '2026-11-08T19:30:00+09:00');
  assert.equal(seoulIso(Date.UTC(2026, 10, 13, 15, 0, 0)), '2026-11-14T00:00:00+09:00');
});

test('isDate, isTime', () => {
  assert.equal(isDate('2026-02-28'), true);
  assert.equal(isDate('2026-02-30'), false);
  assert.equal(isDate('2028-02-29'), true);
  assert.equal(isDate('2026-2-28'), false);
  assert.equal(isDate(20260228), false);
  assert.equal(isTime('00:00'), true);
  assert.equal(isTime('23:59'), true);
  assert.equal(isTime('24:00'), false);
  assert.equal(isTime('9:00'), false);
});

test('addDays, daysBetween, weekdayOf, mondayOf', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-11-10', '2026-11-20'), 10);
  assert.equal(daysBetween('2026-11-20', '2026-11-10'), -10);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(weekdayOf('2026-11-13'), 'fri');
  assert.equal(weekdayOf('2027-02-28'), 'sun');
  assert.equal(mondayOf('2026-11-11'), '2026-11-09');
  assert.equal(mondayOf('2026-11-09'), '2026-11-09');
  assert.equal(mondayOf('2026-11-15'), '2026-11-09');
});

// PC 시간대를 실제로 바꿔 가며 같은 밀리초 입력에 같은 결과가 나오는지 본다.
const ZONES = ['UTC', 'Asia/Seoul', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];

function underEachZone(fn) {
  const saved = process.env.TZ;
  const results = [];
  const offsets = new Set();
  try {
    for (const z of ZONES) {
      process.env.TZ = z;
      offsets.add(new Date(Date.UTC(2026, 10, 13)).getTimezoneOffset());
      results.push(fn());
    }
  } finally {
    process.env.TZ = saved;
  }
  // 시간대가 정말 바뀌었는지 확인해야 이 시험이 뜻이 있다.
  assert.ok(offsets.size >= 4, 'process.env.TZ 바꾸기가 먹지 않음');
  for (const r of results.slice(1)) assert.deepEqual(r, results[0]);
  return results[0];
}

test('PC 시간대가 UTC일 때 (이 파일은 TZ=UTC로 시작)', () => {
  assert.equal(new Date(0).getTimezoneOffset(), 0);
  assert.deepEqual(pick(seoulNow(Date.UTC(2026, 10, 13, 14, 59, 59))), { date: '2026-11-13', time: '23:59', weekday: 'fri' });
  assert.deepEqual(pick(seoulNow(Date.UTC(2026, 10, 13, 15, 0, 0))), { date: '2026-11-14', time: '00:00', weekday: 'sat' });
});

test('PC 시간대가 달라도 결과가 같다: 시각, 날짜 계산', () => {
  const r = underEachZone(() => ({
    before: seoulNow(Date.UTC(2026, 10, 13, 14, 59, 59)),
    after: seoulNow(Date.UTC(2026, 10, 13, 15, 0, 0)),
    iso: seoulIso(Date.UTC(2026, 10, 8, 10, 30, 0)),
    add: addDays('2026-03-08', 1),
    wd: weekdayOf('2026-11-01'),
    mon: mondayOf('2026-11-01'),
    between: daysBetween('2026-03-01', '2026-11-01'),
  }));
  assert.equal(r.after.date, '2026-11-14');
  assert.equal(r.iso, '2026-11-08T19:30:00+09:00');
  assert.equal(r.add, '2026-03-09');
  assert.equal(r.mon, '2026-10-26');
});

test('PC 시간대가 달라도 결과가 같다: 시간표, 안내, 당번, 재로드', () => {
  const b = board({
    notices: [{ id: 'n1', title: '가', startDate: '2026-11-10', endDate: null }],
    duty: { zones: [{ id: 'a', name: '교실' }], students: [1, 2, 3, 4].map((no) => ({ no })), rotate: { startDate: '2026-11-09', unit: 'day', perZone: 1 } },
  });
  const r = underEachZone(() => ({
    tt: todayTimetable(b, kst(2026, 11, 10, 9, 44)),
    night: todayTimetable(b, kst(2026, 11, 13, 23, 59)),
    notices: activeNotices(b, seoulNow(Date.UTC(2026, 10, 9, 15, 0)).date).map((n) => n.id),
    duty: dutyFor(b.duty, seoulNow(kst(2026, 11, 10, 0, 30)).date),
    dawn: isDawnReload(kst(2026, 11, 10, 3, 0), '2026-11-09'),
    stale: staleness(kst(2026, 11, 10, 14, 5), kst(2026, 11, 10, 14, 30)).text,
  }));
  assert.equal(r.tt.rows.find((x) => x.no === 1).state, 'now');
  assert.equal(r.night.status, 'class');
  assert.deepEqual(r.notices, ['n1']);
  assert.deepEqual(r.duty.zones[0].students.map((s) => s.no), [2]);
  assert.equal(r.dawn, true);
  assert.equal(r.stale, '마지막 갱신 14:05');
});
