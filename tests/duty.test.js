import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dutyFor, maskName } from '../js/core/duty.js';
import { board } from './_board.js';

const studentsN = (n) => Array.from({ length: n }, (_, i) => ({ no: i + 1 }));
const duty = (d) => board({ duty: d }).duty;
const nos = (r, zone = 0) => r.zones[zone].students.map((s) => s.no);

const weekly = duty({ zones: [{ id: 'z', name: '교실' }], students: studentsN(10), rotate: { startDate: '2026-11-09', unit: 'week', perZone: 3 } });

test('주 단위, 학생 수가 나누어떨어지지 않음 (10명, 3명씩)', () => {
  assert.deepEqual(nos(dutyFor(weekly, '2026-11-09')), [1, 2, 3]);
  assert.deepEqual(nos(dutyFor(weekly, '2026-11-13')), [1, 2, 3]);
  assert.deepEqual(nos(dutyFor(weekly, '2026-11-16')), [4, 5, 6]);
  assert.deepEqual(nos(dutyFor(weekly, '2026-11-30')), [10, 1, 2]);
  assert.deepEqual(nos(dutyFor(weekly, '2026-12-07')), [3, 4, 5]);
});

test('시작일 이전', () => {
  assert.deepEqual(dutyFor(weekly, '2026-11-06'), { status: 'before', startDate: '2026-11-09', zones: [] });
});

test('시작일이 수요일: 그 주 월요일 기준으로 센다', () => {
  const d = duty({ ...weekly, rotate: { startDate: '2026-11-11', unit: 'week', perZone: 3 } });
  assert.equal(dutyFor(d, '2026-11-10').status, 'before');
  assert.deepEqual(nos(dutyFor(d, '2026-11-11')), [1, 2, 3]);
  assert.deepEqual(nos(dutyFor(d, '2026-11-16')), [4, 5, 6]);
});

test('일 단위 (주말 건너뜀)', () => {
  const d = duty({ ...weekly, rotate: { startDate: '2026-11-09', unit: 'day', perZone: 3 } });
  assert.deepEqual(nos(dutyFor(d, '2026-11-09')), [1, 2, 3]);
  assert.deepEqual(nos(dutyFor(d, '2026-11-13')), [3, 4, 5]);
  assert.deepEqual(nos(dutyFor(d, '2026-11-16')), [6, 7, 8]);
});

test('주말', () => {
  assert.deepEqual(dutyFor(weekly, '2026-11-14'), { status: 'weekend', startDate: null, zones: [] });
});

test('구역이나 학생이 없으면 none', () => {
  assert.equal(dutyFor(duty({}), '2026-11-10').status, 'none');
  assert.equal(dutyFor(duty({ zones: [{ id: 'a', name: '교실' }], mode: 'fixed', fixed: {} }), '2026-11-10').status, 'none');
});

const two = duty({ zones: [{ id: 'a', name: '교실' }, { id: 'b', name: '복도' }], students: studentsN(7), rotate: { startDate: '2026-11-09', unit: 'day', perZone: 2 } });

test('구역 2개', () => {
  const r = dutyFor(two, '2026-11-10');
  assert.equal(r.status, 'ok');
  assert.deepEqual(nos(r, 0), [5, 6]);
  assert.deepEqual(nos(r, 1), [7, 1]);
  assert.deepEqual(r.zones.map((z) => [z.id, z.name]), [['a', '교실'], ['b', '복도']]);
});

test('임시 교체: 바꾸기, 빼기, 다른 날짜는 무시, 없는 번호는 무시', () => {
  const sw = (s) => [{ date: '2026-11-10', zoneId: 'a', from: 5, ...s }];
  assert.deepEqual(nos(dutyFor(two, '2026-11-10', sw({ to: 2 }))), [2, 6]);
  assert.deepEqual(nos(dutyFor(two, '2026-11-10', sw({ to: null }))), [6]);
  assert.deepEqual(nos(dutyFor(two, '2026-11-10', sw({ to: 2, date: '2026-11-11' }))), [5, 6]);
  assert.deepEqual(nos(dutyFor(two, '2026-11-10', sw({ to: 2, from: 3 }))), [5, 6]);
});

test('임시 교체: 기본값은 duty.swaps', () => {
  const d = duty({ ...two, swaps: [{ date: '2026-11-10', zoneId: 'a', from: 5, to: 2 }] });
  assert.deepEqual(nos(dutyFor(d, '2026-11-10')), [2, 6]);
});

test('고정', () => {
  const d = duty({ zones: [{ id: 'a', name: '교실' }], students: studentsN(5), mode: 'fixed', fixed: { tue: { a: [3, 4] } } });
  assert.deepEqual(nos(dutyFor(d, '2026-11-10')), [3, 4]);
  assert.deepEqual(nos(dutyFor(d, '2026-11-11')), []);
});

test('이름 표시: masked 는 번호 + 가린 이름, number 는 번호만', () => {
  const base = { zones: [{ id: 'a', name: '교실' }], mode: 'fixed', fixed: { tue: { a: [3, 4] } } };
  const m = duty({ ...base, nameMode: 'masked', students: [{ no: 3, name: '김○○' }, { no: 4 }] });
  assert.deepEqual(dutyFor(m, '2026-11-10').zones[0].students, [{ no: 3, label: '3번 김○○' }, { no: 4, label: '4번' }]);
  const n = duty({ ...base, students: [{ no: 3 }, { no: 4 }] });
  assert.equal(n.nameMode, 'number');
  assert.equal(dutyFor(n, '2026-11-10').zones[0].students[0].label, '3번');
});

test('학생 순서는 no 오름차순', () => {
  const d = duty({ zones: [{ id: 'a', name: '교실' }], students: [{ no: 9 }, { no: 2 }, { no: 5 }], rotate: { startDate: '2026-11-09', unit: 'day', perZone: 1 } });
  assert.deepEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].map((x) => nos(dutyFor(d, x))), [[2], [5], [9], [2]]);
});

test('maskName', () => {
  assert.equal(maskName('김하늘'), '김○○');
  assert.equal(maskName('이'), '이○');
});
