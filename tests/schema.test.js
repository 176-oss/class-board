import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBoard, defaultBoard, DEFAULT_DESIGN, LIMITS, SUPPORTED_SCHEMA } from '../js/core/schema.js';
import { rawBoard, kst } from './_board.js';

const codes = (r) => r.errors.map((e) => e.code);
const fails = (extra, code) => {
  const r = validateBoard(rawBoard(extra));
  assert.equal(r.ok, false);
  assert.ok(codes(r).includes(code), `기대 ${code}, 실제 ${JSON.stringify(r.errors)}`);
  return r;
};
const notice = (i, extra) => ({ id: `n${i}`, title: '알림', startDate: '2026-11-01', endDate: null, ...extra });

test('정상: 기본값이 채워지고 newer false', () => {
  const r = validateBoard(rawBoard());
  assert.equal(r.ok, true);
  assert.equal(r.newer, false);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.board.design, DEFAULT_DESIGN);
  assert.equal(r.board.minReader, 1);
  assert.deepEqual(r.board.duty.nameMode, 'number');
  assert.equal(SUPPORTED_SCHEMA, 1);
});

test('defaultBoard 는 검사를 통과하고 정규화해도 같다', () => {
  const b = defaultBoard('3학년 2반', kst(2026, 11, 8, 19, 30));
  assert.equal(b.updatedAt, '2026-11-08T19:30:00+09:00');
  assert.equal(b.timetable[0].effectiveFrom, '2026-11-08');
  assert.deepEqual(b.timetable[0].periods.map((p) => `${p.kind}${p.no ?? ''} ${p.start}-${p.end}`), [
    'class1 09:00-09:45', 'class2 09:55-10:40', 'class3 10:50-11:35', 'class4 11:45-12:30',
    'break 12:30-13:20', 'class5 13:20-14:05', 'class6 14:15-15:00', 'class7 15:10-15:55']);
  const r = validateBoard(JSON.stringify(b));
  assert.equal(r.ok, true);
  assert.deepEqual(r.board, b);
});

test('number 모드에 이름이 있으면 오류 name', () => {
  fails({ duty: { nameMode: 'number', students: [{ no: 1, name: '김하늘' }] } }, 'name');
  fails({ duty: { students: [{ no: 1, name: '김하늘' }] } }, 'name');
  fails({ duty: { nameMode: 'masked', students: [{ no: 1, name: '김하늘' }] } }, 'name');
  fails({ duty: { nameMode: 'full', students: [{ no: 1, name: '김 하늘' }] } }, 'name');
  assert.equal(validateBoard(rawBoard({ duty: { nameMode: 'masked', students: [{ no: 1, name: '김○○' }] } })).ok, true);
  assert.equal(validateBoard(rawBoard({ duty: { nameMode: 'full', students: [{ no: 1, name: '김하늘' }] } })).ok, true);
});

test('상한: 끝나지 않은 안내 51개', () => {
  fails({ notices: Array.from({ length: 51 }, (_, i) => notice(i)) }, 'limit');
  // 끝난 안내는 50개 상한에 세지 않는다 (updatedAt 2026-11-10 기준).
  const ended = Array.from({ length: 10 }, (_, i) => notice(100 + i, { endDate: '2026-11-09' }));
  assert.equal(validateBoard(rawBoard({ notices: [...Array.from({ length: 50 }, (_, i) => notice(i)), ...ended] })).ok, true);
  fails({ notices: Array.from({ length: 201 }, (_, i) => notice(i, { endDate: '2026-11-01' })) }, 'limit');
});

test('상한: 제목 41자, 본문 501자, 일정 201개, class 13교시, 구역 13개, 이미지 21개', () => {
  fails({ notices: [notice(1, { title: '가'.repeat(41) })] }, 'limit');
  fails({ notices: [notice(1, { body: '가'.repeat(501) })] }, 'limit');
  fails({ events: Array.from({ length: 201 }, (_, i) => ({ id: `e${i}`, date: '2026-11-20', title: '행사' })) }, 'limit');
  const periods = Array.from({ length: 13 }, (_, i) => ({ kind: 'class', no: i + 1, start: `${String(8 + i).padStart(2, '0')}:00`, end: `${String(8 + i).padStart(2, '0')}:40` }));
  fails({ timetable: [{ effectiveFrom: '2026-03-02', periods, week: {} }] }, 'limit');
  fails({ duty: { zones: Array.from({ length: 13 }, (_, i) => ({ id: `z${i}`, name: '구역' })) } }, 'limit');
  fails({ images: Array.from({ length: 21 }, (_, i) => ({ id: `i${i}`, fileId: 'A'.repeat(20 + i), alt: '', w: 10, h: 10 })) }, 'limit');
  assert.equal(validateBoard(rawBoard({ notices: [notice(1, { title: '가'.repeat(40), body: '가'.repeat(500) })] })).ok, true);
});

test('크기: 204801바이트 문자열은 tooBig, 160000바이트는 통과 + size150', () => {
  const pad = (bytes) => {
    const s = JSON.stringify({ ...rawBoard(), pad: '' });
    return s.replace('"pad":""', `"pad":"${'a'.repeat(bytes - new TextEncoder().encode(s).length)}"`);
  };
  const big = pad(204801);
  assert.equal(new TextEncoder().encode(big).length, 204801);
  assert.deepEqual(validateBoard(big), { ok: false, needsUpdate: false, errors: [{ path: '', code: 'tooBig' }] });
  const mid = pad(160000);
  const r = validateBoard(mid);
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.code === 'size150'));
  assert.equal('pad' in r.board, false);
  assert.equal(validateBoard(pad(204800)).ok, true);
});

test('JSON 파싱 실패', () => {
  assert.deepEqual(validateBoard('{x'), { ok: false, needsUpdate: false, errors: [{ path: '', code: 'json' }] });
});

test('스키마: kind, schemaVersion 2, minReader 2, 미지의 필드', () => {
  assert.deepEqual(codes(validateBoard(rawBoard({ kind: 'x' }))), ['kind']);
  const newer = validateBoard(rawBoard({ schemaVersion: 2 }));
  assert.equal(newer.ok, true);
  assert.equal(newer.newer, true);
  assert.deepEqual(validateBoard(rawBoard({ schemaVersion: 2, minReader: 2 })),
    { ok: false, needsUpdate: true, errors: [{ path: 'minReader', code: 'schemaMajor' }] });
  const unknown = validateBoard(rawBoard({ foo: 1, design: { palette: 'night', free: {} } }));
  assert.equal(unknown.ok, true);
  assert.equal('foo' in unknown.board, false);
  assert.equal('free' in unknown.board.design, false);
});

test('교시 순서: 2교시 start 09:40 (1교시 end 09:45)', () => {
  const periods = [{ kind: 'class', no: 1, start: '09:00', end: '09:45' }, { kind: 'class', no: 2, start: '09:40', end: '10:20' }];
  fails({ timetable: [{ effectiveFrom: '2026-03-02', periods, week: {} }] }, 'order');
  fails({ timetable: [{ effectiveFrom: '2026-03-02', periods: [{ kind: 'class', no: 1, start: '09:45', end: '09:45' }], week: {} }] }, 'order');
});

test('이미지 연결: 없는 imageId 는 ref', () => {
  fails({ notices: [notice(1, { imageId: 'zzz' })] }, 'ref');
});

test('시간표 week 의 period 는 그 요일 class no 여야 한다', () => {
  const r = fails({ timetable: [{ effectiveFrom: '2026-03-02', periods: [{ kind: 'class', no: 1, start: '09:00', end: '09:45' }], week: { mon: [{ period: 2, subject: '국어' }] } }] }, 'ref');
  assert.equal(r.errors[0].path, 'timetable[0].week.mon[0].period');
});

test('design: 틀린 값은 그 필드만 기본값 + 경고', () => {
  const r = validateBoard(rawBoard({ design: { palette: 'pink', fontScale: 1.25, rotateSec: 3, layout: { order: ['duty', 'events', 'notices'] } } }));
  assert.equal(r.ok, true);
  assert.equal(r.board.design.palette, 'honey');
  assert.ok(r.warnings.some((w) => w.code === 'design.palette'));
  assert.equal(r.board.design.fontScale, 1.3);
  assert.equal(r.board.design.rotateSec, 15);
  assert.ok(r.warnings.some((w) => w.code === 'design.rotateSec'));
  assert.deepEqual(r.board.design.layout.order, ['duty', 'events', 'notices']);
});

test('design: 배경 이미지가 없으면 color 로', () => {
  const r = validateBoard(rawBoard({ design: { background: { kind: 'image', imageId: 'nope' } } }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.board.design.background, { kind: 'color', imageId: null, overlay: 0.85 });
  const ok = validateBoard(rawBoard({ images: [{ id: 'bg', fileId: 'A'.repeat(30), alt: '', w: 10, h: 10 }], design: { background: { kind: 'image', imageId: 'bg', overlay: 0.6 } } }));
  assert.deepEqual(ok.board.design.background, { kind: 'image', imageId: 'bg', overlay: 0.6 });
});

test('제어 문자는 오류, 안내 본문의 줄바꿈만 허용', () => {
  fails({ title: '3학년\t2반' }, 'format');
  assert.equal(validateBoard(rawBoard({ notices: [notice(1, { body: '첫 줄\n둘째 줄' })] })).ok, true);
  fails({ notices: [notice(1, { body: '첫 줄\r\n둘째 줄' })] }, 'format');
});

test('id 겹침, 이미지 파일 ID 형식, 당번 perZone', () => {
  fails({ events: [{ id: 'a', date: '2026-11-20', title: '가' }, { id: 'a', date: '2026-11-21', title: '나' }] }, 'duplicate');
  fails({ images: [{ id: 'i', fileId: '../abcdefghijklmnopqrstu', alt: '', w: 10, h: 10 }] }, 'format');
  const r = fails({ duty: { zones: [{ id: 'a', name: '교실' }], students: [{ no: 1 }], rotate: { startDate: '2026-11-09', unit: 'week', perZone: 2 } } }, 'range');
  assert.equal(r.errors[0].path, 'duty.rotate.perZone');
});

test('오래된 안내 경고 oldNotices', () => {
  const r = validateBoard(rawBoard({ notices: [notice(1, { startDate: '2026-07-01', endDate: '2026-08-01' }), notice(2)] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings.find((w) => w.code === 'oldNotices'), { path: 'notices', code: 'oldNotices', count: 1 });
});

test('최악 데이터(16절 10번 분량)도 통과하고 200KB 이하', () => {
  const periods = Array.from({ length: 10 }, (_, i) => ({ kind: 'class', no: i + 1, start: `${String(8 + i).padStart(2, '0')}:00`, end: `${String(8 + i).padStart(2, '0')}:45` }));
  const week = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri'].map((w) => [w, periods.map((p) => ({ period: p.no, subject: '가'.repeat(20), note: '나'.repeat(20) }))]));
  const worst = rawBoard({
    title: '가'.repeat(40),
    timetable: [{ effectiveFrom: '2026-03-02', periods, week }],
    notices: Array.from({ length: LIMITS.activeNotices }, (_, i) => notice(i, { title: '가'.repeat(40), body: '나'.repeat(500) })),
    events: Array.from({ length: 20 }, (_, i) => ({ id: `e${i}`, date: '2026-11-20', title: '가'.repeat(40), note: '나'.repeat(100) })),
    duty: { zones: Array.from({ length: 12 }, (_, i) => ({ id: `z${i}`, name: '가'.repeat(20) })), students: Array.from({ length: 60 }, (_, i) => ({ no: i + 1 })), rotate: { startDate: '2026-11-09', unit: 'week', perZone: 5 } },
  });
  const text = JSON.stringify(worst);
  assert.ok(new TextEncoder().encode(text).length <= LIMITS.bytes);
  assert.equal(validateBoard(text).ok, true);
});

test('인자를 바꾸지 않는다', () => {
  const raw = rawBoard({ design: { palette: 'pink' } });
  const copy = structuredClone(raw);
  validateBoard(raw);
  assert.deepEqual(raw, copy);
});
