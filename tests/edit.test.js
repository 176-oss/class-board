import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findShare, withNames, composeBoard, moveItem, removedFileIds, orphanImageIds, historyToDelete, oldNotices, userTexts, tabOfPath, parseNumbers } from '../js/core/edit.js';
import { fitSize } from '../js/core/image-fit.js';
import { displayUrl } from '../js/core/install.js';
import { diffBoards } from '../js/core/diff.js';
import { phoneWarning } from '../js/core/privacy.js';
import { validateBoard } from '../js/core/schema.js';
import { board, kst } from './_board.js';

test('findShare: 바른 항목과 고칠 anyone 항목', () => {
  const good = { id: 'anyoneWithLink', type: 'anyone', role: 'reader', allowFileDiscovery: false };
  const bad = { id: 'x', type: 'anyone', role: 'writer', allowFileDiscovery: false };
  assert.deepEqual(findShare([{ type: 'user' }, good]), { ok: good, bad: [] });
  assert.deepEqual(findShare([bad]), { ok: null, bad: [bad] });
  assert.deepEqual(findShare([{ ...good, allowFileDiscovery: true }]).ok, null);
  assert.deepEqual(findShare(undefined), { ok: null, bad: [] });
});

const duty = { zones: [{ id: 'a', name: '교실' }], students: [{ no: 1 }, { no: 2 }, { no: 3 }], nameMode: 'number', mode: 'rotate',
  rotate: { startDate: '2026-11-09', unit: 'week', perZone: 1 }, fixed: null, swaps: [], note: '' };
const names = new Map([[1, '김하늘'], [2, ' 이 '], [3, '']]);

test('withNames: number 는 이름 없음, masked 는 가린 글, full 은 전체', () => {
  assert.deepEqual(withNames(duty, names).students, [{ no: 1 }, { no: 2 }, { no: 3 }]);
  assert.deepEqual(withNames(duty, names, 'masked').students, [{ no: 1, name: '김○○' }, { no: 2, name: '이○' }, { no: 3 }]);
  assert.deepEqual(withNames(duty, names, 'full').students, [{ no: 1, name: '김하늘' }, { no: 2, name: '이' }, { no: 3 }]);
  // 이미 가린 이름을 다시 가려도 같다 (불러온 masked 게시판).
  assert.deepEqual(withNames(duty, new Map([[1, '김○○']]), 'masked').students[0], { no: 1, name: '김○○' });
});

test('composeBoard: rev+1, 서울 시각, 지난 교체 지움, 안내 순서, number 이름 없음, 원본 그대로', () => {
  const b = board({
    notices: [{ id: 'n1', title: 'A', startDate: '2026-11-01', order: 50 }, { id: 'n2', title: 'B', startDate: '2026-11-01', order: -3 }],
    duty: { ...duty, swaps: [{ date: '2026-11-09', zoneId: 'a', from: 1, to: 2 }, { date: '2026-11-10', zoneId: 'a', from: 1, to: null }] },
  });
  const before = JSON.stringify(b);
  const out = composeBoard(b, { names, serverRev: 7, nowMs: kst(2026, 11, 10, 8, 30) });
  assert.equal(JSON.stringify(b), before);
  assert.equal(out.rev, 8);
  assert.equal(out.updatedAt, '2026-11-10T08:30:00+09:00');
  assert.deepEqual(out.duty.swaps.map((s) => s.date), ['2026-11-10']);
  assert.deepEqual(out.notices.map((n) => [n.id, n.order]), [['n1', 0], ['n2', 1]]);
  assert.ok(!JSON.stringify(out).includes('김하늘'));
  assert.ok(validateBoard(out).ok);
});

test('moveItem: 범위 밖이면 그대로', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
  assert.deepEqual(moveItem(['a', 'b'], 0, -1), ['a', 'b']);
  assert.deepEqual(moveItem(['a', 'b'], 1, 1), ['a', 'b']);
});

test('removedFileIds, orphanImageIds', () => {
  assert.deepEqual(removedFileIds([{ fileId: 'x' }, { fileId: 'y' }, { fileId: 'y' }], [{ fileId: 'y' }]), ['x']);
  const now = Date.UTC(2026, 10, 10);
  const listed = [
    { id: 'old', modifiedTime: new Date(now - 86400001).toISOString() },
    { id: 'new', modifiedTime: new Date(now - 3600000).toISOString() },
    { id: 'used', modifiedTime: new Date(now - 9e8).toISOString() },
  ];
  assert.deepEqual(orphanImageIds(listed, [{ fileId: 'used' }], now), ['old']);
});

test('historyToDelete: 6번째부터', () => {
  const list = [3, 9, 1, 7, 5, 8, 2].map((rev) => ({ id: 'h' + rev, rev }));
  assert.deepEqual(historyToDelete(list).map((x) => x.rev), [2, 1]);
  assert.deepEqual(historyToDelete(list.slice(0, 5)), []);
});

test('oldNotices: 끝난 지 90일 넘음', () => {
  const ns = [{ endDate: '2026-08-11' }, { endDate: '2026-08-12' }, { endDate: null }];
  assert.equal(oldNotices(ns, '2026-11-10').length, 1);
});

test('userTexts: 사람이 쓴 글만 모아 전화번호 검사', () => {
  const b = board({
    notices: [{ id: 'n1', title: '연락', body: '담임 010-1234-5678', startDate: '2026-11-01' }],
    images: [{ id: 'i1', fileId: 'fake01012345678901234567', alt: '', w: 10, h: 10 }],
  });
  assert.deepEqual(phoneWarning(userTexts(b).join('\n')), ['010-1234-5678']);
  assert.ok(!userTexts(b).some((s) => s.includes('fake')));
});

test('tabOfPath, parseNumbers', () => {
  assert.equal(tabOfPath('notices[3].title'), 'notices');
  assert.equal(tabOfPath('noClass[0].label'), 'timetable');
  assert.equal(tabOfPath('duty.rotate.perZone'), 'duty');
  assert.equal(tabOfPath('title'), 'design');
  assert.equal(tabOfPath(''), null);
  assert.deepEqual(parseNumbers('3, 7 12번'), [3, 7, 12]);
  assert.deepEqual(parseNumbers(''), []);
});

test('fitSize: 긴 변 1600 이하, 비율 유지, 키우지 않음', () => {
  assert.deepEqual(fitSize(4000, 3000), { w: 1600, h: 1200 });
  assert.deepEqual(fitSize(3000, 4000), { w: 1200, h: 1600 });
  assert.deepEqual(fitSize(800, 600), { w: 800, h: 600 });
  assert.deepEqual(fitSize(1600, 1600), { w: 1600, h: 1600 });
  assert.deepEqual(fitSize(10000, 3), { w: 1600, h: 1 });
  assert.deepEqual(fitSize(2000, 1000, 1280), { w: 1280, h: 640 });
});

test('displayUrl: 형식이 틀린 ID 는 throw', () => {
  const id = 'fake' + 'a'.repeat(24);
  assert.equal(displayUrl('https://176-oss.github.io/class-board/', id), `https://176-oss.github.io/class-board/?f=${id}`);
  for (const bad of ['../x', 'a'.repeat(19), '<script>', 123]) assert.throws(() => displayUrl('https://x/', bad));
});

test('diffBoards: 칸별 추가·삭제·변경', () => {
  const server = board({
    notices: [{ id: 'n1', title: '가', startDate: '2026-11-01' }, { id: 'n2', title: '나', startDate: '2026-11-01' }],
    events: [{ id: 'e1', date: '2026-11-20', title: '체험' }],
  });
  const mine = structuredClone(server);
  mine.notices[0].body = '바뀜';
  mine.notices.splice(1, 1);
  mine.notices.push({ ...mine.notices[0], id: 'n3', title: '다' });
  mine.design.palette = 'night';
  const d = diffBoards(mine, server);
  assert.deepEqual(d, [
    { section: '안내', added: ['다'], removed: ['나'], changed: ['가'] },
    { section: '디자인', added: [], removed: [], changed: ['디자인'] },
  ]);
  assert.deepEqual(diffBoards(server, server), []);
});
