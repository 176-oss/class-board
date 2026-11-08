// 표시 화면 시작, 확인 주기, 백오프, 캐시, 커서, Wake Lock, 재로드 (계약 9절).
import { DRIVE_API_KEY } from '../../config.js';
import { validateBoard } from '../core/schema.js';
import { seoulNow } from '../core/time.js';
import { isValidFileId } from '../core/ids.js';
import { DISPLAY_TEXT, isFakeMode } from '../core/drive-common.js';
import { startDelay, backoffDelay, connectRetryDelay, staleness, clockSkew, isDawnReload } from '../core/net.js';
import { renderBoard, renderMessage, applyPalette } from './render.js';
import { createKeySource } from './source.js';
import { createFakeSource } from './fake-source.js';
import { syncImages, loadUrls, imageUrl, clearImages } from './images.js';

const MIN = 60000;
const params = new URLSearchParams(location.search);
const fake = isFakeMode(location);
const root = document.getElementById('board');

// 가짜 모드에서만 ?now=2026-11-10T10:00(서울 시각)으로 시계를 옮겨 화면을 확인한다.
let offset = 0;
if (fake && params.get('now')) {
  const t = Date.parse(params.get('now') + ':00+09:00');
  if (Number.isFinite(t)) offset = t - Date.now();
}
const now = () => Date.now() + offset;

let fileId = params.get('f');
const key = (part) => `classboard:${part}:${fileId}`;
let source = null;
let reg = null;
let checkTimer = 0;
let pageTimer = 0;
let checking = false;
const state = {
  board: null, seenVersion: null, lastOk: null, lastCheck: 0, fails: 0, notFound: 0, page: 0,
  badAddress: false, needsUpdate: false, readFailed: false, forbidden: false,
};

function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(key('board')));
    const r = c && validateBoard(c.text);
    if (r?.ok) { state.board = r.board; state.seenVersion = c.version; }
  } catch { /* 깨진 캐시는 없는 것으로 */ }
  const ok = Number(localStorage.getItem(key('ok')));
  state.lastOk = ok > 0 ? ok : null;
}

function notes() {
  const t = now();
  const out = [];
  const s = staleness(state.lastOk, t);
  if (s.text) out.push(s.text);
  if (state.board && clockSkew(state.board.updatedAt, t)) out.push(DISPLAY_TEXT.clockSkew);
  if (state.needsUpdate) out.push(DISPLAY_TEXT.needsUpdate);
  if (state.readFailed) out.push(DISPLAY_TEXT.readFailed);
  if (state.forbidden) out.push(DISPLAY_TEXT.forbidden);
  return out;
}

function schedulePage({ pageCount, dutyPages = 1, pageSec }) {
  if (Math.max(pageCount, dutyPages) <= 1) { clearTimeout(pageTimer); pageTimer = 0; return; }
  if (pageTimer) return;
  pageTimer = setTimeout(() => {
    pageTimer = 0;
    // 안내와 당번 쪽 수가 달라 render 가 각각 나머지를 구한다.
    state.page++;
    draw();
  }, pageSec * 1000);
}

function draw() {
  const ctx = { notes: state.badAddress ? [] : notes(), badge: fake ? DISPLAY_TEXT.fakeMode : '' };
  const palette = !state.badAddress && state.board ? state.board.design.palette : 'honey';
  applyPalette(document.documentElement, palette);
  if (state.badAddress) return renderMessage(root, DISPLAY_TEXT.badAddress, DISPLAY_TEXT.badAddressSub, ctx);
  if (!state.board) return renderMessage(root, DISPLAY_TEXT.connecting, DISPLAY_TEXT.connectingSub, ctx);
  schedulePage(renderBoard(root, state.board, { ...ctx, nowMs: now(), page: state.page, imageUrl }));
}

// 공유를 끊거나 지운 내용이 이 PC에 남지 않게 한다.
async function forget() {
  Object.assign(state, { badAddress: true, board: null, seenVersion: null, lastOk: null, readFailed: false, needsUpdate: false });
  for (const part of ['board', 'ok', 'reload']) localStorage.removeItem(key(part));
  await clearImages(fileId).catch(() => {});
}

async function check() {
  if (checking) return;
  checking = true;
  clearTimeout(checkTimer);
  state.lastCheck = Date.now();
  let delay = MIN;
  try {
    const meta = await source.getMeta(fileId);
    state.notFound = 0;
    state.badAddress = false;
    state.forbidden = false;
    if (meta.version !== state.seenVersion) {
      const text = await source.getText(fileId);
      const r = validateBoard(text);
      state.seenVersion = meta.version;
      if (r.ok) {
        Object.assign(state, { board: r.board, needsUpdate: false, readFailed: false });
        localStorage.setItem(key('board'), JSON.stringify({ text, version: meta.version, modifiedTime: meta.modifiedTime }));
      } else {
        Object.assign(state, { needsUpdate: r.needsUpdate, readFailed: !r.needsUpdate });
        if (r.needsUpdate) reg?.update().catch(() => {});
      }
    }
    state.fails = 0;
    if (state.board && !state.needsUpdate && !state.readFailed) {
      state.lastOk = now();
      localStorage.setItem(key('ok'), String(state.lastOk));
    }
    if (state.board) await syncImages(source, fileId, state.board, seoulNow(now()).date).catch(() => {});
  } catch (e) {
    const kind = e?.kind ?? 'network';
    if (kind === 'notFound') {
      state.notFound++;
      if (state.notFound >= 2) { await forget(); delay = 5 * MIN; }
    } else {
      state.fails++;
      if (kind === 'forbidden') state.forbidden = true;
      if (kind === 'invalid') state.readFailed = true;
      delay = state.board ? backoffDelay(state.fails, Math.random()) : connectRetryDelay(state.fails);
    }
  }
  checking = false;
  draw();
  checkTimer = setTimeout(check, delay);
}

async function dawnReload(t) {
  if (!isDawnReload(t, localStorage.getItem(key('reload')))) return;
  try {
    const res = await fetch('./sw.js?ping=' + t, { cache: 'no-store' });
    if (res.status !== 200) return;
    localStorage.setItem(key('reload'), seoulNow(t).date);
    location.reload();
  } catch { /* 오프라인이면 내일 다시 */ }
}

function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  // 처음 설치 때는 다시 읽지 않는다 (같은 파일이라 의미 없음).
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) location.reload(); });
  navigator.serviceWorker.register('./sw.js').then((r) => {
    reg = r;
    r.update().catch(() => {});
    setInterval(() => r.update().catch(() => {}), 6 * 3600000);
  }).catch(() => {});
}

async function wakeLock() {
  try {
    if (document.visibilityState === 'visible') await navigator.wakeLock?.request('screen');
  } catch { /* 거부돼도 조용히 */ }
}

function setupCursor() {
  let t = 0;
  const show = () => {
    document.documentElement.classList.remove('cb-nocursor');
    clearTimeout(t);
    t = setTimeout(() => document.documentElement.classList.add('cb-nocursor'), 3000);
  };
  addEventListener('mousemove', show);
  show();
}

async function start() {
  setupCursor();
  wakeLock();
  setupServiceWorker();
  // 글꼴을 먼저 읽어야 넘침 계산(fit)이 실제 글꼴 기준이 된다.
  await Promise.all(['400', '500', '600'].map((w) => document.fonts?.load(`${w} 16px "IBM Plex Sans KR"`))).catch(() => {});

  let seeded = false;
  if (fake && params.get('seed')) {
    const { seedFake } = await import('./dev-seed.js');
    const id = await seedFake(params.get('seed')).catch(() => null);
    if (id) {
      fileId = id;
      seeded = true;
      params.set('f', id);
      params.delete('seed');
      history.replaceState(null, '', '?' + params);
    }
  }

  if (!isValidFileId(fileId)) {
    state.badAddress = true;
    draw();
    return;
  }
  if (!fake && DRIVE_API_KEY === '') {
    renderMessage(root, DISPLAY_TEXT.needKey);
    return;
  }
  source = fake ? createFakeSource() : createKeySource({ apiKey: DRIVE_API_KEY });
  loadCache();
  if (state.board) await loadUrls(fileId, state.board).catch(() => {});
  draw();
  checkTimer = setTimeout(check, seeded ? 0 : startDelay(!!state.board, Math.random()));

  let minute = '';
  setInterval(() => {
    const t = now();
    const s = seoulNow(t);
    if (s.date + s.time === minute) return;
    minute = s.date + s.time;
    draw();
    if (!state.badAddress) dawnReload(t);
  }, 1000);
  addEventListener('resize', draw);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    wakeLock();
    if (state.lastCheck && Date.now() - state.lastCheck > MIN) check();
  });
  // 같은 출처 입력 화면이 가짜 저장소에 쓰면 바로 확인한다.
  if (fake) addEventListener('storage', (e) => { if (e.key?.startsWith('classboard:fake:')) check(); });
}

start();
