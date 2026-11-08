// 진짜 구글 드라이브 AdminDrive (계약 5-2~5-4). 구글 로그인 스크립트는 로그인할 때만 넣는다.
import { GOOGLE_CLIENT_ID } from '../../config.js';
import { API, UPLOAD, SCOPES, DriveError, ADMIN_MESSAGES, classifyDriveError, metaUrl, mediaUrl } from '../core/drive-common.js';
import { isValidFileId, randomId, boardFileName, imageFileName, historyFileName, parseHistoryName } from '../core/ids.js';
import { SHARE_BODY, findShare, historyToDelete } from '../core/edit.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const TOKEN_KEY = 'classboard:admin:token';
const TIMEOUT_MS = 30000;
const enc = encodeURIComponent;

const loginError = (key) => Object.assign(new Error(ADMIN_MESSAGES[key]), { kind: 'login' });
const unconfirmed = () => Object.assign(new Error(ADMIN_MESSAGES.shareUnconfirmed), { kind: 'unconfirmed' });
const id = (fileId) => {
  if (!isValidFileId(fileId)) throw new DriveError('invalid');
  return enc(fileId);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let token = null;

function readToken() {
  if (!token) {
    try { token = JSON.parse(sessionStorage.getItem(TOKEN_KEY)); } catch { token = null; }
  }
  // 만료 1분 전부터는 쓰지 않는다 (요청 도중 만료 방지).
  if (token?.accessToken && token.expiresAt - 60000 > Date.now()) return token.accessToken;
  return null;
}
function clearToken() {
  token = null;
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* 막혀 있으면 메모리만 */ }
}

let gis = null;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gis) return gis;
  gis = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    const fail = () => { gis = null; s.remove(); reject(new DriveError('network')); };
    const timer = setTimeout(fail, 15000);
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); fail(); };
    document.head.append(s);
  });
  return gis;
}

async function req(url, { method = 'GET', headers = {}, body, op = 'read', as = 'json' } = {}) {
  const t = readToken();
  if (!t) throw new DriveError('auth', { status: 401 });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    let res;
    try {
      res = await fetch(url, { method, headers: { ...headers, Authorization: `Bearer ${t}` }, body, cache: 'no-store', signal: ctl.signal });
    } catch {
      throw new DriveError('network');
    }
    if (!res.ok) {
      if (res.status === 401) clearToken();
      let j = null;
      try { j = await res.json(); } catch { /* 본문 없음 */ }
      throw new DriveError(classifyDriveError({ status: res.status, body: j, op }), { status: res.status });
    }
    if (as === null) return null;
    try {
      return await res[as]();
    } catch {
      throw new DriveError('network');
    }
  } finally {
    clearTimeout(timer);
  }
}

function multipart(meta, part, partType) {
  const boundary = 'cb' + randomId(16);
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${partType}\r\n\r\n`;
  return { body: new Blob([head, part, `\r\n--${boundary}--`]), type: `multipart/related; boundary=${boundary}` };
}

async function createFile(meta, part, partType, fields = 'id,name,version,modifiedTime') {
  const { body, type } = multipart(meta, part, partType);
  return req(`${UPLOAD}?uploadType=multipart&fields=${fields}`, { method: 'POST', headers: { 'Content-Type': type }, body, op: 'write' });
}

const listPerms = async (fileId) =>
  (await req(`${API}/${id(fileId)}/permissions?fields=${enc('permissions(id,type,role,allowFileDiscovery)')}`, { op: 'share' })).permissions ?? [];
const deletePerm = (fileId, permId) => req(`${API}/${id(fileId)}/permissions/${enc(permId)}`, { method: 'DELETE', op: 'share', as: null });

// 계약 5-7: 만들고, 목록으로 확인하고, 안 보이면 2초 뒤 한 번 더.
async function shareFile(fileId) {
  const { ok, bad } = findShare(await listPerms(fileId));
  for (const p of bad) await deletePerm(fileId, p.id);
  if (!ok) {
    await req(`${API}/${id(fileId)}/permissions?fields=id,type,role,allowFileDiscovery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(SHARE_BODY), op: 'share',
    });
  }
  for (let i = 0; i < 2; i++) {
    if (findShare(await listPerms(fileId)).ok) return;
    if (i === 0) await wait(2000);
  }
  throw unconfirmed();
}

async function createShared(meta, part, partType) {
  const made = await createFile(meta, part, partType);
  try {
    await shareFile(made.id);
  } catch (e) {
    await deleteFile(made.id).catch(() => {});
    throw e;
  }
  return made;
}

async function deleteFile(fileId) {
  await req(`${API}/${id(fileId)}`, { method: 'DELETE', op: 'delete', as: null });
}

async function getMeta(fileId) {
  const j = await req(metaUrl(fileId));
  return { version: String(j.version), modifiedTime: j.modifiedTime };
}

async function listHistory(boardId) {
  id(boardId);
  const q = `name contains 'classboard-hist-${boardId}-' and trashed=false`;
  const j = await req(`${API}?spaces=appDataFolder&q=${enc(q)}&fields=${enc('files(id,name,modifiedTime)')}&pageSize=100`, { op: 'list' });
  return (j.files ?? [])
    .map((f) => ({ f, h: parseHistoryName(f.name) }))
    .filter(({ h }) => h && h.boardId === boardId)
    .map(({ f, h }) => ({ id: f.id, rev: h.rev, modifiedTime: f.modifiedTime }))
    .sort((a, b) => b.rev - a.rev);
}

export function createAdminDrive() {
  return {
    signIn({ consent = false } = {}) {
      return loadGis().then(() => new Promise((resolve, reject) => {
        const oauth = window.google.accounts.oauth2;
        const client = oauth.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: (resp) => {
            if (resp.error) {
              reject(loginError(/access_denied|admin_policy|org_internal|disallowed/i.test(String(resp.error)) ? 'loginDenied' : 'auth'));
              return;
            }
            if (!oauth.hasGrantedAllScopes(resp, ...SCOPES.split(' '))) { reject(loginError('loginScopes')); return; }
            token = { accessToken: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
            try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token)); } catch { /* 메모리만 */ }
            resolve();
          },
          error_callback: (err) => reject(loginError(err?.type === 'popup_failed_to_open' ? 'loginPopup' : 'auth')),
        });
        client.requestAccessToken({ prompt: consent ? 'consent' : '' });
      }));
    },
    hasToken: () => !!readToken(),
    async signOut() {
      const t = readToken();
      clearToken();
      if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t, () => {});
    },

    async listBoards() {
      const q = "appProperties has { key='classboard' and value='board' } and trashed=false";
      const j = await req(`${API}?q=${enc(q)}&fields=${enc('files(id,name,version,modifiedTime)')}&orderBy=${enc('modifiedTime desc')}&pageSize=50`, { op: 'list' });
      return (j.files ?? []).filter((f) => isValidFileId(f.id)).map((f) => ({ ...f, version: String(f.version) }));
    },
    async createBoard(board) {
      const made = await createShared({ name: boardFileName(), mimeType: 'application/json', appProperties: { classboard: 'board' } },
        JSON.stringify(board), 'application/json; charset=UTF-8');
      // 공유를 만들면 version 이 오를 수 있어 마지막 값을 다시 받는다.
      return { id: made.id, ...(await getMeta(made.id)) };
    },
    getMeta,
    readText: (fileId) => req(mediaUrl(fileId), { as: 'text' }),
    async saveBoard(fileId, text) {
      const j = await req(`${UPLOAD}/${id(fileId)}?uploadType=media&fields=version,modifiedTime`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: text, op: 'write',
      });
      return { version: String(j.version), modifiedTime: j.modifiedTime };
    },
    async uploadImage(boardId, jpegBlob) {
      id(boardId);
      const made = await createShared({ name: imageFileName(), mimeType: 'image/jpeg', appProperties: { classboard: 'image', board: boardId } }, jpegBlob, 'image/jpeg');
      return { id: made.id };
    },
    readImage: (fileId) => req(mediaUrl(fileId), { as: 'blob' }),
    async shareState(fileId) {
      return findShare(await listPerms(fileId)).ok ? 'shared' : 'stopped';
    },
    share: shareFile,
    async unshare(fileId) {
      for (const p of await listPerms(fileId)) if (p.type === 'anyone') await deletePerm(fileId, p.id);
    },
    deleteFile,
    async listImages(boardId) {
      id(boardId);
      const q = `appProperties has { key='board' and value='${boardId}' } and trashed=false`;
      const j = await req(`${API}?q=${enc(q)}&fields=${enc('files(id,modifiedTime)')}&pageSize=100`, { op: 'list' });
      return (j.files ?? []).filter((f) => isValidFileId(f.id));
    },
    listHistory,
    async writeHistory(boardId, rev, text) {
      await createFile({ name: historyFileName(boardId, rev), parents: ['appDataFolder'], mimeType: 'application/json' }, text, 'application/json; charset=UTF-8', 'id,name');
      for (const old of historyToDelete(await listHistory(boardId))) await deleteFile(old.id);
    },
  };
}
