// 가짜 드라이브 (계약 6절): AdminDrive 전부 + asSource(). 저장 모양은 표시 화면 fake-source.js 와 같다.
import { DriveError, ADMIN_MESSAGES } from './drive-common.js';
import { isValidFileId, randomId, boardFileName, imageFileName, historyFileName, parseHistoryName } from './ids.js';
import { SHARE_BODY, findShare, historyToDelete } from './edit.js';

export const FAKE_INDEX = 'classboard:fake:index';
export const FAKE_TEXT = 'classboard:fake:text:';
const STATUS = { network: null, rateLimit: 429, auth: 401, shareBlocked: 403, forbidden: 403, notFound: 404, invalid: 400 };

export function createFakeDrive({ store, now = () => Date.now() }) {
  let signed = false;
  let offline = false;
  let shareBlocked = false;
  const queue = [];
  const calls = [];

  async function load() {
    try {
      const v = JSON.parse(await store.getText(FAKE_INDEX));
      if (v && v.files && typeof v.files === 'object') return v;
    } catch { /* 없거나 깨지면 빈 목록 */ }
    return { files: {} };
  }
  const saveIndex = (idx) => store.setText(FAKE_INDEX, JSON.stringify(idx));
  const fail = (kind) => new DriveError(kind, { status: STATUS[kind] ?? null });

  async function gate(name, { auth = true } = {}) {
    calls.push(name);
    if (offline) throw fail('network');
    if (queue.length) throw fail(queue.shift());
    if (auth && !signed) throw fail('auth');
  }
  async function file(id) {
    if (!isValidFileId(id)) throw fail('invalid');
    const idx = await load();
    const f = idx.files[id];
    if (!f) throw fail('notFound');
    return { idx, f };
  }
  const touch = (f) => { f.version = (Number(f.version) || 0) + 1; f.modifiedTime = new Date(now()).toISOString(); };

  async function create(meta, content) {
    const idx = await load();
    const id = 'fake' + randomId(24);
    const f = { parents: [], appProperties: {}, ...meta, version: 0, modifiedTime: '', perms: [] };
    touch(f);
    if (typeof content === 'string') await store.setText(FAKE_TEXT + id, content);
    else await store.setBlob(id, content);
    idx.files[id] = f;
    await saveIndex(idx);
    return { id, version: String(f.version), modifiedTime: f.modifiedTime };
  }
  async function remove(id) {
    const { idx } = await file(id);
    delete idx.files[id];
    await saveIndex(idx);
    await store.removeText(FAKE_TEXT + id);
    await store.removeBlob(id);
  }
  async function setPerms(id, fn) {
    const { idx, f } = await file(id);
    f.perms = fn(f.perms ?? []);
    touch(f);
    await saveIndex(idx);
  }
  // 진짜처럼: 공유 만들기 → 목록으로 확인. 확인되지 않으면 throw.
  async function shareFile(id) {
    if (shareBlocked) throw fail('shareBlocked');
    const { ok, bad } = findShare((await file(id)).f.perms);
    if (!ok || bad.length) await setPerms(id, (perms) => [...perms.filter((p) => p.type !== 'anyone'), ok ?? { id: 'anyoneWithLink', ...SHARE_BODY }]);
    if (!findShare((await file(id)).f.perms).ok) throw Object.assign(new Error(ADMIN_MESSAGES.shareUnconfirmed), { kind: 'unconfirmed' });
  }
  const list = async (pred) => Object.entries((await load()).files).filter(([, f]) => pred(f));

  const drive = {
    calls,
    async signIn() { calls.push('signIn'); signed = true; },
    hasToken: () => signed,
    async signOut() { signed = false; },

    async listBoards() {
      await gate('listBoards');
      return (await list((f) => f.appProperties?.classboard === 'board' && !(f.parents ?? []).includes('appDataFolder')))
        .map(([id, f]) => ({ id, name: f.name, version: String(f.version), modifiedTime: f.modifiedTime }))
        .sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1));
    },
    async createBoard(board) {
      await gate('createBoard');
      const made = await create({ name: boardFileName(), mimeType: 'application/json', appProperties: { classboard: 'board' } }, JSON.stringify(board));
      try {
        await shareFile(made.id);
      } catch (e) {
        await remove(made.id);
        throw e;
      }
      return { id: made.id, ...(await drive.getMeta(made.id)) };
    },
    async getMeta(id) {
      await gate('getMeta');
      const { f } = await file(id);
      return { version: String(f.version), modifiedTime: f.modifiedTime };
    },
    async readText(id) {
      await gate('readText');
      await file(id);
      const t = await store.getText(FAKE_TEXT + id);
      if (t === null || t === undefined) throw fail('notFound');
      return t;
    },
    async saveBoard(id, text) {
      await gate('saveBoard');
      const { idx, f } = await file(id);
      await store.setText(FAKE_TEXT + id, text);
      touch(f);
      await saveIndex(idx);
      return { version: String(f.version), modifiedTime: f.modifiedTime };
    },
    async uploadImage(boardId, blob) {
      await gate('uploadImage');
      const made = await create({ name: imageFileName(), mimeType: 'image/jpeg', appProperties: { classboard: 'image', board: boardId } }, blob);
      try {
        await shareFile(made.id);
      } catch (e) {
        await remove(made.id);
        throw e;
      }
      return { id: made.id };
    },
    async readImage(id) {
      await gate('readImage');
      await file(id);
      const b = await store.getBlob(id);
      if (!b) throw fail('notFound');
      return b;
    },
    async shareState(id) {
      await gate('shareState');
      const { f } = await file(id);
      return findShare(f.perms).ok ? 'shared' : 'stopped';
    },
    async share(id) {
      await gate('share');
      await shareFile(id);
    },
    async unshare(id) {
      await gate('unshare');
      await setPerms(id, (perms) => perms.filter((p) => p.type !== 'anyone'));
    },
    async deleteFile(id) {
      await gate('deleteFile');
      await remove(id);
    },
    async listImages(boardId) {
      await gate('listImages');
      return (await list((f) => f.appProperties?.board === boardId)).map(([id, f]) => ({ id, modifiedTime: f.modifiedTime }));
    },
    async listHistory(boardId) {
      await gate('listHistory');
      return (await list((f) => (f.parents ?? []).includes('appDataFolder')))
        .map(([id, f]) => ({ id, modifiedTime: f.modifiedTime, h: parseHistoryName(f.name) }))
        .filter((x) => x.h && x.h.boardId === boardId)
        .map(({ id, modifiedTime, h }) => ({ id, rev: h.rev, modifiedTime }))
        .sort((a, b) => b.rev - a.rev);
    },
    async writeHistory(boardId, rev, text) {
      await gate('writeHistory');
      await create({ name: historyFileName(boardId, rev), mimeType: 'application/json', parents: ['appDataFolder'] }, text);
      for (const old of historyToDelete(await drive.listHistory(boardId))) await remove(old.id);
    },

    // 표시 화면 읽기: 로그인 없이, 링크 공유가 없으면 notFound (진짜와 같게).
    asSource() {
      const shared = async (name, id) => {
        await gate(name, { auth: false });
        const { f } = await file(id);
        if (!(f.perms ?? []).some((p) => p.type === 'anyone' && p.role === 'reader')) throw fail('notFound');
      };
      return {
        async getMeta(id) {
          await shared('source.getMeta', id);
          const { f } = await file(id);
          return { version: String(f.version), modifiedTime: f.modifiedTime };
        },
        async getText(id) {
          await shared('source.getText', id);
          return store.getText(FAKE_TEXT + id);
        },
        async getImage(id) {
          await shared('source.getImage', id);
          return store.getBlob(id);
        },
      };
    },

    setOffline(v) { offline = !!v; },
    failNext(kind, count = 1) { for (let i = 0; i < count; i++) queue.push(kind); },
    blockShare(v) { shareBlocked = !!v; },
    async files() { return (await load()).files; },
  };
  return drive;
}
