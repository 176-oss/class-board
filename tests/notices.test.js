import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeNotices, pageNotices, richLines, noticeChars } from '../js/core/notices.js';
import { seoulNow } from '../js/core/time.js';
import { board } from './_board.js';

const today = seoulNow(Date.UTC(2026, 10, 9, 15, 0)).date;
const n = (id, extra) => ({ id, title: '제목', startDate: '2026-11-01', endDate: null, ...extra });
const ids = (list) => list.map((x) => x.id);

test('오늘 = 2026-11-10 (UTC 11-09 15:00)', () => {
  assert.equal(today, '2026-11-10');
});

test('activeNotices: 시작일=오늘 포함, 시작 전 빠짐', () => {
  const b = board({ notices: [n('a', { startDate: '2026-11-10' }), n('b', { startDate: '2026-11-11' })] });
  assert.deepEqual(ids(activeNotices(b, today)), ['a']);
});

test('activeNotices: 종료일=어제 빠짐, 종료일=오늘 포함', () => {
  const b = board({ notices: [n('y', { endDate: '2026-11-09' }), n('t', { endDate: '2026-11-10' })] });
  assert.deepEqual(ids(activeNotices(b, today)), ['t']);
});

test('activeNotices: 정렬 important, order, startDate, id', () => {
  const b = board({ notices: [
    n('f0', { important: false, order: 0 }),
    n('t5', { important: true, order: 5 }),
    n('t1', { important: true, order: 1 }),
    n('z', { important: false, order: 0, startDate: '2026-10-01' }),
    n('e', { important: false, order: 0 }),
  ] });
  assert.deepEqual(ids(activeNotices(b, today)), ['t1', 't5', 'z', 'e', 'f0']);
});

// 제목 1자 + 본문으로 글자 수를 맞춘다.
const sized = (id, chars, extra) => ({ id, title: '가', body: '나'.repeat(chars - 1), important: false, ...extra });
const sizes = (r) => r.pages.map((p) => p.items.map(noticeChars));

test('noticeChars 는 코드 포인트 기준', () => {
  assert.equal(noticeChars({ title: '가나', body: 'ab\n𠀀' }), 6);
});

test('pageNotices: 시간 sec = max(rotateSec, ceil(글자/8))', () => {
  assert.equal(pageNotices([sized('a', 200)], { rotateSec: 15 }).pages[0].sec, 25);
  assert.equal(pageNotices([sized('a', 80)], { rotateSec: 15 }).pages[0].sec, 15);
});

test('pageNotices: 나누기 300, 300, 100, [300,300], [100]', () => {
  const r = pageNotices([sized('a', 300), sized('b', 300), sized('c', 100)], { rotateSec: 15 });
  assert.deepEqual(sizes(r), [[300, 300], [100]]);
});

test('pageNotices: 한 페이지 최대 3개', () => {
  const r = pageNotices(['a', 'b', 'c', 'd'].map((id) => sized(id, 10)), { rotateSec: 15 });
  assert.deepEqual(sizes(r), [[10, 10, 10], [10]]);
});

// 계약 표의 '540 하나 + 50, [540], [50]'은 PAGE_CHARS 600 규칙과 맞지 않는다 (590 <= 600). 규칙대로의 결과와
// '혼자 PAGE_CHARS를 넘는 안내'를 따로 시험한다. 보고서 '계약서 수정 제안' 참고.
test('pageNotices: 큰 안내 540 + 50 은 규칙대로 한 페이지', () => {
  assert.deepEqual(sizes(pageNotices([sized('a', 540), sized('b', 50)], { rotateSec: 15 })), [[540, 50]]);
});

test('pageNotices: 혼자 PAGE_CHARS 를 넘는 안내는 혼자 한 페이지', () => {
  assert.deepEqual(sizes(pageNotices([sized('a', 50), sized('b', 640), sized('c', 50)], { rotateSec: 15 })), [[50], [640], [50]]);
});

test('pageNotices: fontScale 이 크면 PAGE_CHARS 가 줄어든다 (600/1.2 = 500)', () => {
  assert.deepEqual(sizes(pageNotices([sized('a', 300), sized('b', 250)], { rotateSec: 15, fontScale: 1.2 })), [[300], [250]]);
});

test('pageNotices: 이미지가 있는 안내는 혼자 한 페이지', () => {
  const r = pageNotices([sized('a', 10), sized('b', 10, { imageId: 'im1' }), sized('c', 10)], { rotateSec: 15 });
  assert.deepEqual(r.pages.map((p) => ids(p.items)), [['a'], ['b'], ['c']]);
});

test('pageNotices: 고정은 important 앞 2개, pages 에도 포함', () => {
  const list = ['a', 'b', 'c'].map((id) => sized(id, 10, { important: true }));
  const r = pageNotices(list, { rotateSec: 15 });
  assert.deepEqual(ids(r.pinned), ['a', 'b']);
  assert.deepEqual(r.pages.flatMap((p) => ids(p.items)), ['a', 'b', 'c']);
});

test('pageNotices: 빈 목록', () => {
  assert.deepEqual(pageNotices([], { rotateSec: 15 }), { pinned: [], pages: [] });
});

test('richLines: 줄 나눔과 굵게', () => {
  assert.deepEqual(richLines('준비물: **실내화**\n끝'), [
    [{ text: '준비물: ', bold: false }, { text: '실내화', bold: true }],
    [{ text: '끝', bold: false }],
  ]);
});

test('richLines: 짝 없는 ** 는 글자 그대로', () => {
  assert.deepEqual(richLines('a**b'), [[{ text: 'a**b', bold: false }]]);
  assert.deepEqual(richLines('**a** b **c'), [[{ text: 'a', bold: true }, { text: ' b **c', bold: false }]]);
  assert.deepEqual(richLines(''), [[]]);
});
