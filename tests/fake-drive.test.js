import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeDrive, FAKE_INDEX, FAKE_TEXT } from '../js/core/fake-drive.js';
import { defaultBoard, validateBoard } from '../js/core/schema.js';
import { isValidFileId } from '../js/core/ids.js';

function memStore() {
  const text = new Map();
  const blob = new Map();
  return {
    text, blob,
    getText: async (k) => (text.has(k) ? text.get(k) : null), setText: async (k, v) => { text.set(k, v); }, removeText: async (k) => { text.delete(k); },
    getBlob: async (k) => blob.get(k) ?? null, setBlob: async (k, v) => { blob.set(k, v); }, removeBlob: async (k) => { blob.delete(k); },
  };
}

let clock = Date.UTC(2026, 10, 8, 1);
const setup = async () => {
  const store = memStore();
  const d = createFakeDrive({ store, now: () => clock });
  await d.signIn({});
  return { store, d };
};

test('로그인 전에는 auth', async () => {
  const d = createFakeDrive({ store: memStore() });
  assert.equal(d.hasToken(), false);
  await assert.rejects(d.listBoards(), (e) => e.kind === 'auth');
});

test('만들기: 계약 6절 저장 모양, 공유 확인됨, 표시 쪽에서 읽힘', async () => {
  const { store, d } = await setup();
  const made = await d.createBoard(defaultBoard('3학년 2반', clock));
  assert.ok(isValidFileId(made.id) && made.id.startsWith('fake') && made.id.length === 28);
  const idx = JSON.parse(store.text.get(FAKE_INDEX));
  const f = idx.files[made.id];
  assert.match(f.name, /^board-[a-z0-9]{12}\.json$/);
  assert.deepEqual(f.appProperties, { classboard: 'board' });
  assert.deepEqual(f.perms.map(({ type, role, allowFileDiscovery }) => ({ type, role, allowFileDiscovery })), [{ type: 'anyone', role: 'reader', allowFileDiscovery: false }]);
  assert.equal(made.version, String(f.version));
  assert.equal(await d.shareState(made.id), 'shared');
  const src = d.asSource();
  assert.ok(validateBoard(await src.getText(made.id)).ok);
  assert.deepEqual((await d.listBoards()).map((b) => b.id), [made.id]);
});

test('만들기: 공유가 막히면 파일을 지우고 shareBlocked', async () => {
  const { store, d } = await setup();
  d.blockShare(true);
  await assert.rejects(d.createBoard(defaultBoard('x', clock)), (e) => e.kind === 'shareBlocked');
  assert.deepEqual(Object.keys(JSON.parse(store.text.get(FAKE_INDEX)).files), []);
  assert.equal([...store.text.keys()].filter((k) => k.startsWith(FAKE_TEXT)).length, 0);
});

test('저장마다 version 증가, 공유 끊으면 표시 쪽은 notFound', async () => {
  const { d } = await setup();
  const { id, version } = await d.createBoard(defaultBoard('x', clock));
  const saved = await d.saveBoard(id, '{"a":1}');
  assert.equal(Number(saved.version), Number(version) + 1);
  assert.equal((await d.getMeta(id)).version, saved.version);
  await d.unshare(id);
  assert.equal(await d.shareState(id), 'stopped');
  await assert.rejects(d.asSource().getMeta(id), (e) => e.kind === 'notFound');
  await d.share(id);
  assert.equal((await d.asSource().getText(id)), '{"a":1}');
});

test('이미지: 공유되어 올라가고 board 표시, 삭제하면 사라짐', async () => {
  const { store, d } = await setup();
  const { id } = await d.createBoard(defaultBoard('x', clock));
  const img = await d.uploadImage(id, new Blob(['jpeg']));
  const f = (await d.files())[img.id];
  assert.equal(f.mimeType, 'image/jpeg');
  assert.match(f.name, /^img-[a-z0-9]{12}\.jpg$/);
  assert.deepEqual(f.appProperties, { classboard: 'image', board: id });
  assert.equal(await (await d.asSource().getImage(img.id)).text(), 'jpeg');
  assert.deepEqual((await d.listImages(id)).map((x) => x.id), [img.id]);
  await d.deleteFile(img.id);
  assert.equal(store.blob.has(img.id), false);
  await assert.rejects(d.readImage(img.id), (e) => e.kind === 'notFound');
});

test('이미지: 게시판이 공유 중지면 새 이미지도 공유하지 않고, 다시 공유하면 함께 공유됨 (L2)', async () => {
  const { d } = await setup();
  const { id } = await d.createBoard(defaultBoard('x', clock));
  await d.unshare(id);
  const img = await d.uploadImage(id, new Blob(['jpeg']));
  assert.equal(await d.shareState(img.id), 'stopped');
  await assert.rejects(d.asSource().getImage(img.id), (e) => e.kind === 'notFound');
  // [다시 공유하기]와 같은 순서: 이미지들 → 본 파일
  for (const f of await d.listImages(id)) await d.share(f.id);
  await d.share(id);
  assert.equal(await d.shareState(img.id), 'shared');
  assert.equal(await (await d.asSource().getImage(img.id)).text(), 'jpeg');
});

test('이력: appDataFolder, 공유 없음, 5개만 rev 내림차순', async () => {
  const { d } = await setup();
  const { id } = await d.createBoard(defaultBoard('x', clock));
  for (let rev = 1; rev <= 7; rev++) await d.writeHistory(id, rev, `r${rev}`);
  const h = await d.listHistory(id);
  assert.deepEqual(h.map((x) => x.rev), [7, 6, 5, 4, 3]);
  assert.equal(await d.readText(h[0].id), 'r7');
  const f = (await d.files())[h[0].id];
  assert.deepEqual(f.parents, ['appDataFolder']);
  assert.deepEqual(f.perms, []);
  await assert.rejects(d.asSource().getText(h[0].id), (e) => e.kind === 'notFound');
  assert.equal((await d.listBoards()).length, 1);
});

test('시험 도구: failNext, setOffline, 잘못된 ID', async () => {
  const { d } = await setup();
  d.failNext('rateLimit');
  await assert.rejects(d.listBoards(), (e) => e.kind === 'rateLimit' && e.status === 429);
  assert.deepEqual(await d.listBoards(), []);
  d.setOffline(true);
  await assert.rejects(d.listBoards(), (e) => e.kind === 'network');
  d.setOffline(false);
  await assert.rejects(d.getMeta('../x'), (e) => e.kind === 'invalid');
  assert.ok(d.calls.includes('listBoards'));
});
