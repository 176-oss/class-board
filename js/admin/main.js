// 입력 화면 시작, 로그인, 게시판 목록·만들기·열기, 저장 절차, 공유, 되돌리기, 삭제 (계약 5-6~5-8, 10-2).
import { S, hooks } from './state.js';
import { h, button, say, dialog, confirmBox, field } from './ui.js';
import { createAdminDrive } from './drive.js';
import { browserStore } from '../fake-store.js';
import { createFakeDrive } from '../core/fake-drive.js';
import { validateBoard, defaultBoard } from '../core/schema.js';
import { ADMIN_MESSAGES, DISPLAY_TEXT, isFakeMode } from '../core/drive-common.js';
import { composeBoard, removedFileIds, orphanImageIds, userTexts, tabOfPath } from '../core/edit.js';
import { diffBoards } from '../core/diff.js';
import { phoneWarning } from '../core/privacy.js';
import { seoulNow } from '../core/time.js';
import { renderBoard } from '../display/render.js';
import * as notices from './tab-notices.js';
import * as timetable from './tab-timetable.js';
import * as events from './tab-events.js';
import * as duty from './tab-duty.js';
import * as images from './tab-images.js';
import * as design from './tab-design.js';
import * as connect from './tab-connect.js';
import { unlinkImage } from './tab-images.js';

const NEWER = '더 새 버전의 입력 화면에서 저장한 게시판입니다. 새로고침하세요';
const SAVED = '저장했습니다. 학급 PC에는 1분 안에 반영됩니다';
const TABS = [['notices', '안내', notices], ['timetable', '시간표', timetable], ['events', '일정', events], ['duty', '청소당번', duty],
  ['images', '이미지', images], ['design', '디자인', design], ['connect', '학급 PC 연결', connect]];
const CODE_TEXT = {
  required: '꼭 넣어야 합니다', type: '형식이 맞지 않습니다', format: '형식이 맞지 않습니다', limit: '너무 길거나 개수가 너무 많습니다',
  range: '허용 범위를 벗어났습니다', ref: '없는 항목을 가리킵니다', duplicate: '다른 항목과 겹칩니다', name: '이름 형식이 맞지 않습니다',
  tooBig: '200KB를 넘어 저장할 수 없습니다', json: '형식이 맞지 않습니다',
};

const $ = (id) => document.getElementById(id);
const fake = isFakeMode(location);
S.fake = fake;
S.drive = fake ? createFakeDrive({ store: browserStore }) : createAdminDrive();
const drive = S.drive;

let tab = 'notices';
let lastCheck = { ok: true, errors: [], warnings: [] };
let previewBoard = null;
let page = 0;
let busy = false;
let checkTimer = 0;

function errorText(e) {
  if (e.code === 'order') return /endDate$/.test(e.path) ? '끝 날짜가 시작 날짜보다 빠릅니다' : '시각 순서가 맞지 않습니다. 시작은 끝보다 앞서고, 앞 행의 끝보다 이르면 안 됩니다';
  if (e.path === 'duty.rotate.perZone' && e.code === 'range') return '구역 수 x 구역당 인원이 학생 수보다 많습니다';
  if (e.path === 'notices' && e.code === 'limit') return '끝나지 않은 안내는 50개까지입니다';
  if (e.code?.startsWith('design.')) return '허용 범위를 벗어나 기본값으로 저장됩니다';
  return CODE_TEXT[e.code] ?? '확인이 필요합니다';
}

// 오류 경로와 가장 가까운 칸을 찾는다 ('notices[2].title' → 없으면 'notices[2]' …).
function findField(path) {
  const panel = $('panel');
  for (let p = path; p;) {
    const el = panel.querySelector(`[data-path="${CSS.escape(p)}"]`);
    if (el?.errorEl) return el;
    const up = p.replace(/(\[\d+\]|\.[^.[\]]+)$/, '');
    if (up === p) break;
    p = up;
  }
  return null;
}

function showProblems() {
  const errors = lastCheck.ok ? [] : lastCheck.errors;
  const warns = lastCheck.ok ? lastCheck.warnings.filter((w) => w.code.startsWith('design.')) : [];
  for (const el of $('panel').querySelectorAll('[data-path]')) {
    el.removeAttribute('aria-invalid');
    if (el.errorEl) { el.errorEl.hidden = true; el.errorEl.textContent = ''; el.errorEl.classList.remove('is-warn'); }
  }
  const left = [];
  for (const e of [...errors, ...warns]) {
    const el = tabOfPath(e.path) === tab || e.path === '' ? findField(e.path) : null;
    if (!el) { if (tabOfPath(e.path) === tab || !tabOfPath(e.path)) left.push(e); continue; }
    el.errorEl.hidden = false;
    el.errorEl.textContent = [el.errorEl.textContent, errorText(e)].filter(Boolean).join(' / ');
    if (errors.includes(e)) el.setAttribute('aria-invalid', 'true');
    else el.errorEl.classList.add('is-warn');
  }
  const counts = {};
  for (const e of errors) { const t = tabOfPath(e.path); if (t) counts[t] = (counts[t] ?? 0) + 1; }
  for (const btn of $('tabs').children) {
    const n = counts[btn.dataset.tab] ?? 0;
    btn.querySelector('.tab-count').textContent = n ? ` (고칠 곳 ${n})` : '';
  }
  $('errors').replaceChildren(...left.map((e) => h('p', { class: 'field-err', text: errorText(e) })));
  $('errors').hidden = !left.length;
}

function compose(serverRev = S.serverRev) {
  return composeBoard(S.board, { names: S.names, serverRev, nowMs: Date.now() });
}

function check() {
  clearTimeout(checkTimer);
  if (!S.board) return;
  lastCheck = validateBoard(compose());
  if (lastCheck.ok) previewBoard = lastCheck.board;
  showProblems();
  drawPreview();
}

function drawPreview() {
  const box = $('preview');
  const note = $('preview-note');
  if (!previewBoard || !box.offsetParent) return;
  box.style.setProperty('--u', box.parentElement.clientWidth / 100 + 'px');
  const r = renderBoard(box, previewBoard, { nowMs: Date.now(), page, imageUrl: (fid) => S.imgUrls.get(fid) ?? null, badge: fake ? DISPLAY_TEXT.fakeMode : '' });
  const pages = r.pageCount;
  $('preview-page').hidden = pages <= 1;
  $('preview-page').querySelector('span').textContent = `다음 안내 페이지 (${(page % Math.max(1, pages)) + 1} / ${pages})`;
  note.textContent = lastCheck.ok ? '저장 전 내용입니다. 학급 PC에는 저장한 뒤 1분 안에 보입니다.' : '고칠 곳이 있어 마지막으로 바르던 내용을 보여 줍니다.';
}

function updateHeader() {
  const open = !!S.board;
  $('board-title').textContent = open ? S.board.title || '이름 없는 게시판' : '학급 게시판 입력';
  for (const id of ['btn-save', 'btn-boards', 'share-state', 'save-note']) $(id).hidden = !open;
  $('btn-save').disabled = S.newer;
  $('dirty').hidden = !(open && S.dirty);
  const st = $('share-state');
  st.textContent = S.shared === 'shared' ? '공유 중' : S.shared === 'stopped' ? '공유 중지됨' : '공유 상태 확인 못함';
  st.className = `pill ${S.shared === 'shared' ? 'is-on' : 'is-off'}`;
  $('btn-unshare').hidden = !(open && S.shared === 'shared');
  $('btn-reshare').hidden = !(open && S.shared !== 'shared');
}

function renderPanel() {
  const panel = $('panel');
  panel.replaceChildren();
  const [, , mod] = TABS.find(([k]) => k === tab);
  panel.setAttribute('aria-labelledby', `tab-${tab}`);
  panel.dataset.tab = tab;
  // 탭 모듈은 배열과 null 을 섞어 넘긴다 (h() 와 같은 규칙).
  mod.render({ append: (...kids) => panel.append(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false)) });
  if (S.newer) for (const el of panel.querySelectorAll('input, textarea, select')) el.disabled = true;
  showProblems();
}

hooks.rerender = (focusKey) => {
  const key = focusKey ?? document.activeElement?.dataset?.key;
  renderPanel();
  if (key) $('panel').querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
  updateHeader();
};
hooks.changed = () => {
  S.dirty = true;
  S.editSeq++;
  updateHeader();
  clearTimeout(checkTimer);
  checkTimer = setTimeout(check, 200);
};

function showError(e, read = false) {
  const msg = e?.kind === 'network' && read ? ADMIN_MESSAGES.networkRead : e?.message || ADMIN_MESSAGES.invalid;
  say(msg, { error: true });
  $('relogin').hidden = e?.kind !== 'auth';
}

// 드라이브 작업 하나를 감싼다: 겹쳐 누르기 막기, 실패 문구.
hooks.run = async (fn, { read = false } = {}) => {
  if (busy) { say('앞의 작업이 끝날 때까지 기다려 주세요'); return undefined; }
  busy = true;
  document.body.classList.add('is-busy');
  try {
    return await fn();
  } catch (e) {
    showError(e, read);
    return undefined;
  } finally {
    busy = false;
    document.body.classList.remove('is-busy');
  }
};
const run = hooks.run;

function selectTab(k, focus = false) {
  tab = k;
  for (const btn of $('tabs').children) {
    const on = btn.dataset.tab === k;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
    if (on && focus) btn.focus();
  }
  renderPanel();
}

function buildTabs() {
  const list = $('tabs');
  list.replaceChildren(...TABS.map(([k, label]) => h('button', {
    type: 'button', role: 'tab', id: `tab-${k}`, 'aria-controls': 'panel', 'aria-selected': 'false', tabIndex: -1, 'data-tab': k,
    onclick: () => selectTab(k),
  }, h('span', { text: label }), h('span', { class: 'tab-count' }))));
  list.addEventListener('keydown', (e) => {
    const i = TABS.findIndex(([k]) => k === tab);
    const n = TABS.length;
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    selectTab(TABS[to][0], true);
  });
}

// ---------- 게시판 열기 ----------

function loadDraft(board, { keepNames = false } = {}) {
  const b = structuredClone(board);
  const names = new Map(b.duty.students.filter((s) => s.name).map((s) => [s.no, s.name]));
  if (!keepNames || names.size) S.names = names;
  b.duty.students = b.duty.students.map(({ no }) => ({ no }));
  b.notices.sort((x, y) => x.order - y.order);
  S.board = b;
}

async function loadImages() {
  for (const im of S.board?.images ?? []) {
    if (S.imgUrls.has(im.fileId)) continue;
    try { S.imgUrls.set(im.fileId, URL.createObjectURL(await drive.readImage(im.fileId))); } catch { /* 미리보기에 대체 글 */ }
  }
  drawPreview();
  if (tab === 'images' || tab === 'notices') hooks.rerender();
}

function clearImages() {
  for (const u of S.imgUrls.values()) URL.revokeObjectURL(u);
  S.imgUrls.clear();
}

async function openBoard(id) {
  const meta = await drive.getMeta(id);
  const text = await drive.readText(id);
  const r = validateBoard(text);
  if (!r.ok) { say(r.needsUpdate ? NEWER : ADMIN_MESSAGES.invalid, { error: true }); return; }
  clearImages();
  S.fileId = id;
  loadDraft(r.board);
  Object.assign(S, { serverText: text, serverRev: r.board.rev, baseVersion: meta.version, newer: r.newer, dirty: false, shared: null });
  page = 0;
  previewBoard = null;
  $('start').hidden = true;
  $('edit').hidden = false;
  selectTab('notices', true);
  check();
  updateHeader();
  if (r.newer) say(NEWER, { error: true });
  S.shared = await drive.shareState(id).catch(() => null);
  updateHeader();
  if (tab === 'connect') hooks.rerender();
  loadImages();
  // 저장하지 않고 닫아 남은 이미지 정리 (24시간 넘은 것만).
  drive.listImages(id).then((list) => Promise.all(orphanImageIds(list, r.board.images, Date.now()).map((f) => drive.deleteFile(f).catch(() => {})))).catch(() => {});
}

// ---------- 첫 화면 ----------

async function showStart() {
  S.board = null;
  S.fileId = null;
  S.dirty = false;
  S.names = new Map();
  clearImages();
  $('edit').hidden = true;
  $('start').hidden = false;
  updateHeader();
  const box = $('start-body');
  if (!drive.hasToken()) {
    box.replaceChildren(
      h('p', { text: fake ? '가짜 드라이브 모드입니다. 구글로 아무것도 보내지 않고 이 브라우저에만 저장합니다.' : '게시판은 내 구글 드라이브에 저장됩니다. 구글 계정으로 로그인하세요.' }),
      button(fake ? '로그인 (가짜 드라이브)' : '구글 로그인', async () => { await run(() => drive.signIn({})); if (drive.hasToken()) showStart(); }, { kind: 'primary' }));
    box.querySelector('button').focus();
    return;
  }
  box.replaceChildren(h('p', { text: '게시판 목록을 불러오는 중입니다' }));
  const list = await run(() => drive.listBoards(), { read: true });
  if (!list) { box.replaceChildren(button('다시 불러오기', showStart, { kind: 'primary' })); return; }
  const rows = await Promise.all(list.map(async (f) => {
    let title = '(내용을 읽지 못함)';
    try { const r = validateBoard(await drive.readText(f.id)); if (r.ok) title = r.board.title; } catch { /* 제목만 못 보임 */ }
    return { ...f, title };
  }));
  const name = h('input', { type: 'text', maxLength: 40, autocomplete: 'off' });
  const create = () => run(async () => {
    const title = name.value.trim();
    if (!title || /[\u0000-\u001F\u007F]/.test(title) || [...title].length > 40) { say('학급 이름을 1~40자로 넣어 주세요', { error: true }); name.focus(); return; }
    say('게시판을 만들고 공유를 확인하는 중입니다');
    const made = await drive.createBoard(defaultBoard(title, Date.now()));
    await openBoard(made.id);
    say('새 게시판을 만들었습니다. 공유도 확인했습니다');
  });
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
  box.replaceChildren(
    h('section', { class: 'sec' }, h('h2', { text: '내 게시판' }),
      rows.length ? h('ul', { class: 'board-list' }, rows.map((f) => h('li', { class: 'card inline' },
        h('span', { class: 'grow' }, h('strong', { text: f.title }), h('span', { class: 'hint', text: `  마지막 저장 ${fmtTime(f.modifiedTime)}` })),
        button('열기', () => run(() => openBoard(f.id), { read: true }), { kind: 'primary' }))))
        : h('p', { class: 'empty', text: '아직 게시판이 없습니다' })),
    h('section', { class: 'sec' }, h('h2', { text: '새 게시판 만들기' }),
      field('학급 이름', name, { hint: '예: 3학년 2반. 만들면 링크 공유를 켜고 확인한 뒤에 완료됩니다' }),
      button('새 게시판 만들기', create, { kind: 'primary', ic: 'plus' })),
    h('div', { class: 'bar' }, button('로그아웃', async () => { await drive.signOut(); showStart(); })));
  (box.querySelector('.board-list button') ?? name).focus();
}

function fmtTime(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = seoulNow(t);
  return `${Number(s.date.slice(5, 7))}월 ${Number(s.date.slice(8))}일 ${s.time}`;
}

// ---------- 저장 (계약 5-6) ----------

async function conflictChoice(serverText, mine) {
  const server = validateBoard(serverText);
  for (;;) {
    const v = await dialog({
      title: '다른 곳에서 이 게시판을 먼저 저장했습니다.',
      body: [h('p', { text: '서버 내용을 불러오면 내 변경은 사라집니다. 덮어쓰면 다른 곳에서 저장한 내용이 사라집니다.' })],
      actions: [{ label: '서버 내용 불러오기', value: 'load' }, { label: '내 내용으로 덮어쓰기', value: 'overwrite', kind: 'danger' }, { label: '차이 보기', value: 'diff' }],
    });
    if (v !== 'diff') return v;
    const list = server.ok ? diffBoards(mine, server.board) : null;
    const part = (label, arr) => (arr.length ? h('li', { text: `${label}: ${arr.join(', ')}` }) : null);
    await dialog({
      title: '차이 보기',
      body: list === null ? [h('p', { text: ADMIN_MESSAGES.invalid })]
        : list.length ? list.map((d) => h('section', {}, h('h3', { text: d.section }),
          h('ul', {}, part('내 쪽에만 있음', d.added), part('서버에만 있음', d.removed), d.changed.length === 1 && d.changed[0] === d.section ? h('li', { text: '내용이 다름' }) : part('내용이 다름', d.changed))))
          : [h('p', { text: '내용 차이가 없습니다' })],
      actions: [{ label: '돌아가기', value: 'back' }],
    });
  }
}

function focusFirstError() {
  const first = lastCheck.errors?.find((e) => tabOfPath(e.path));
  if (!first) return;
  if (tabOfPath(first.path) !== tab) selectTab(tabOfPath(first.path));
  const el = findField(first.path);
  el?.closest('details')?.setAttribute('open', '');
  el?.focus();
}

async function save() {
  if (!S.board || busy) return;
  if (S.newer) { say(NEWER, { error: true }); return; }
  check();
  if (!lastCheck.ok) {
    const big = lastCheck.errors.some((e) => e.code === 'tooBig');
    say(big ? CODE_TEXT.tooBig : `고칠 곳이 ${lastCheck.errors.length}군데 있어 저장하지 않았습니다`, { error: true });
    focusFirstError();
    return;
  }
  const phones = phoneWarning(userTexts(lastCheck.board).join('\n'));
  if (phones.length && !(await confirmBox('전화번호 확인', `전화번호로 보이는 글이 있습니다: ${phones.join(', ')}. 그래도 저장할까요?`, '그래도 저장'))) return;
  const seq = S.editSeq;
  await run(async () => {
    const id = S.fileId;
    const meta = await drive.getMeta(id);
    let prevText = S.serverText;
    if (meta.version !== S.baseVersion) {
      prevText = await drive.readText(id);
      const choice = await conflictChoice(prevText, lastCheck.board);
      if (choice === 'load') {
        const r = validateBoard(prevText);
        if (!r.ok) throw Object.assign(new Error(ADMIN_MESSAGES.invalid), { kind: 'invalid' });
        loadDraft(r.board, { keepNames: true });
        Object.assign(S, { serverText: prevText, serverRev: r.board.rev, baseVersion: meta.version, newer: r.newer, dirty: false });
        hooks.rerender();
        check();
        loadImages();
        say('서버 내용을 불러왔습니다');
        return;
      }
      if (choice !== 'overwrite') { say('저장하지 않았습니다'); return; }
    }
    let prev = null;
    try { prev = JSON.parse(prevText); } catch { /* 깨진 서버 본문: rev 만 이어 간다 */ }
    const prevRev = Number.isInteger(prev?.rev) ? prev.rev : S.serverRev;
    const r = validateBoard(compose(prevRev));
    if (!r.ok) { lastCheck = r; showProblems(); say('고칠 곳이 있어 저장하지 않았습니다', { error: true }); return; }
    const text = JSON.stringify(r.board);
    const res = await drive.saveBoard(id, text);
    Object.assign(S, { baseVersion: res.version, serverText: text, serverRev: r.board.rev, dirty: S.editSeq !== seq });
    updateHeader();
    let histFail = false;
    try { await drive.writeHistory(id, prevRev, prevText); } catch { histFail = true; }
    for (const f of removedFileIds(prev?.images, r.board.images)) {
      await drive.deleteFile(f).catch(() => {});
      URL.revokeObjectURL(S.imgUrls.get(f) ?? '');
      S.imgUrls.delete(f);
    }
    say(histFail ? `${SAVED}. 이전 버전 보관에 실패했습니다` : SAVED, { error: histFail });
  });
}

// ---------- 공유, 되돌리기, 삭제 ----------

async function allImageIds() {
  const ids = new Set(S.board.images.map((i) => i.fileId));
  try { for (const i of JSON.parse(S.serverText).images ?? []) ids.add(i.fileId); } catch { /* 없음 */ }
  for (const f of await drive.listImages(S.fileId)) ids.add(f.id);
  return [...ids];
}

// 공유를 바꾸면 version 이 오를 수 있다. 바로 전까지 같았으면 새 값으로 맞춰 거짓 충돌을 막는다.
async function keepBase(fn) {
  const before = await drive.getMeta(S.fileId);
  await fn();
  if (before.version === S.baseVersion) S.baseVersion = (await drive.getMeta(S.fileId)).version;
}

hooks.unshare = async () => {
  if (!(await confirmBox('지금 공유 끊기', '학급 PC 화면에 더 이상 보이지 않습니다. 끊을까요?', '공유 끊기', { danger: true }))) return;
  await run(async () => {
    await keepBase(() => drive.unshare(S.fileId));
    S.shared = 'stopped';
    updateHeader();
    let failed = 0;
    for (const f of await allImageIds()) await drive.unshare(f).catch((e) => { if (e.kind !== 'notFound') failed++; });
    hooks.rerender('share:again');
    say(failed ? `공유를 끊었습니다. 이미지 ${failed}개는 끊지 못했습니다. 다시 누르세요` : '공유를 끊었습니다. 학급 PC 화면에 더 이상 보이지 않습니다', { error: !!failed });
  });
  if (S.shared === 'stopped') $('btn-reshare').focus();
};

hooks.reshare = () => run(async () => {
  for (const f of await allImageIds()) await drive.share(f).catch((e) => { if (e.kind !== 'notFound') throw e; });
  await keepBase(() => drive.share(S.fileId));
  S.shared = 'shared';
  updateHeader();
  hooks.rerender('share:stop');
  say('다시 공유했습니다. 학급 PC에는 1분 안에 다시 보입니다');
});

hooks.restore = () => run(async () => {
  const list = await drive.listHistory(S.fileId);
  if (!list.length) { say('보관된 이전 버전이 없습니다'); return; }
  const v = await dialog({
    title: '이전으로 되돌리기',
    body: [h('p', { text: '고른 버전을 편집 화면에 불러옵니다. 저장해야 학급 PC에 반영됩니다.' })],
    actions: [...list.map((x) => ({ label: `${fmtTime(x.modifiedTime)}에 보관 (rev ${x.rev})`, value: x.id })), { label: '취소', value: 'no' }],
  });
  if (!v || v === 'no') return;
  const r = validateBoard(await drive.readText(v));
  if (!r.ok) throw Object.assign(new Error(ADMIN_MESSAGES.invalid), { kind: 'invalid' });
  let gone = 0;
  for (const im of [...r.board.images]) {
    try { await drive.getMeta(im.fileId); } catch (e) {
      if (e.kind !== 'notFound') throw e;
      gone++;
      unlinkImage(r.board, im.id);
    }
  }
  loadDraft(r.board, { keepNames: true });
  S.dirty = true;
  S.editSeq++;
  hooks.rerender();
  check();
  loadImages();
  say(gone ? `이전 버전을 불러왔습니다. 삭제된 이미지 ${gone}개는 되돌릴 수 없습니다` : '이전 버전을 불러왔습니다. 저장하면 학급 PC에 반영됩니다');
}, { read: true });

hooks.remove = async () => {
  const done = await run(async () => {
    const id = S.fileId;
    const title = S.board.title;
    const imgs = await allImageIds();
    const hist = await drive.listHistory(id);
    const typed = h('input', { type: 'text', autocomplete: 'off' });
    const v = await dialog({
      title: '게시판 삭제',
      body: [h('p', {}, h('strong', { text: `게시판, 이미지 ${imgs.length}개, 이전 버전 ${hist.length}개가 모두 영구 삭제됩니다. 되돌릴 수 없습니다.` })),
        field(`확인을 위해 학급 이름 '${title}'을 그대로 입력하세요`, typed)],
      actions: [{ label: '취소', value: 'no' }, { label: '영구 삭제', value: 'yes', kind: 'danger' }],
      setup: (dlg, btns) => {
        const del = btns[1];
        del.disabled = true;
        typed.addEventListener('input', () => { del.disabled = typed.value !== title; });
      },
    });
    if (v !== 'yes') return false;
    // 본 파일을 마지막에 지워야 중간에 실패해도 다시 찾아 나머지를 지울 수 있다.
    const gone = (f) => drive.deleteFile(f).catch((e) => { if (e.kind !== 'notFound') throw e; });
    try {
      for (const f of imgs) await gone(f);
      for (const x of hist) await gone(x.id);
      await gone(id);
    } catch (e) {
      say('일부만 삭제되었습니다. 다시 누르면 나머지를 지웁니다', { error: true });
      $('relogin').hidden = e?.kind !== 'auth';
      return false;
    }
    for (const k of Object.keys(localStorage)) if (k.startsWith('classboard:') && k.endsWith(':' + id)) localStorage.removeItem(k);
    await caches.delete('classboard:img:' + id).catch(() => {});
    return true;
  });
  if (!done) return;
  S.dirty = false;
  await showStart();
  say('게시판을 영구 삭제했습니다');
};

// ---------- 시작 ----------

function start() {
  $('fake-badge').hidden = !fake;
  buildTabs();
  $('btn-save').addEventListener('click', save);
  $('btn-unshare').addEventListener('click', hooks.unshare);
  $('btn-reshare').addEventListener('click', hooks.reshare);
  $('btn-boards').addEventListener('click', async () => {
    if (S.dirty && !(await confirmBox('게시판 목록', '저장하지 않은 변경이 있습니다. 버리고 목록으로 갈까요?', '버리고 가기', { danger: true }))) return;
    showStart();
  });
  $('btn-relogin').addEventListener('click', () => run(async () => { await drive.signIn({}); $('relogin').hidden = true; say('다시 로그인했습니다. 하던 일을 다시 눌러 주세요'); }));
  $('preview-page').addEventListener('click', () => { page++; drawPreview(); });
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  addEventListener('beforeunload', (e) => {
    if (!S.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });
  new ResizeObserver(() => drawPreview()).observe($('preview-frame'));
  // 분이 바뀌면 시계·시간표 미리보기를 다시 그린다.
  setInterval(drawPreview, 30000);
  showStart();
}

start();
