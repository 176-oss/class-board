// 학급 게시판 스파이크: 기획서 4절 1~8번을 사람이 버튼으로 시험하고 결과를 복사해 보낸다.
// 시험용이라 본 개발 코드로 쓰지 않는다. innerHTML 없음, 외부 코드는 구글 로그인 스크립트만.
import { GOOGLE_CLIENT_ID, DRIVE_API_KEY } from './config.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const KEY_STORE = 'classboard:spike:key';
const FILES_STORE = 'classboard:spike:files';
const ID_RE = /^[A-Za-z0-9_-]{20,80}$/;
const SHARE = { type: 'anyone', role: 'reader', allowFileDiscovery: false };

const $ = (id) => document.getElementById(id);
let token = null;
let timer = null;
// 크롬은 가려진 탭의 setTimeout/setInterval을 1분 단위로 늦춘다. 워커 안 타이머는 늦추지 않아서 측정에 쓴다
function workerTimer(ms, fn, once) {
  const src = `${once ? 'setTimeout' : 'setInterval'}(() => postMessage(0), ${ms})`;
  const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  w.onmessage = () => { if (once) w.terminate(); fn(); };
  return w;
}
const every = (fn, ms) => workerTimer(ms, fn, false);
const lines = [];

// ---------- 기록 ----------
function log(item, ok, text) {
  const t = new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
  const mark = ok === true ? '통과' : ok === false ? '실패' : '정보';
  const line = `[${t}] ${item} ${mark}: ${text}`;
  lines.push(line);
  const li = document.createElement('li');
  li.className = ok === true ? 'ok' : ok === false ? 'fail' : '';
  li.textContent = line;
  $('log').prepend(li);
}
const say = (msg) => { $('status').textContent = msg; };

// ---------- 공통 ----------
function rand(n) {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => abc[b % abc.length]).join('');
}
function randId() { // 형식은 맞지만 없는 파일 ID
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  return Array.from(crypto.getRandomValues(new Uint8Array(33)), (b) => abc[b % 64]).join('');
}
const apiKey = () => DRIVE_API_KEY || localStorage.getItem(KEY_STORE) || '';
const files = () => { try { return JSON.parse(localStorage.getItem(FILES_STORE) || '{}'); } catch { return {}; } };
const saveFiles = (f) => localStorage.setItem(FILES_STORE, JSON.stringify(f));

// 응답을 상태, Content-Type, 본문 앞부분으로 요약. 네트워크/CORS 오류는 status 0
async function call(url, opts = {}) {
  const started = performance.now();
  try {
    const res = await fetch(url, { cache: 'no-store', ...opts });
    const ctype = res.headers.get('content-type') || '';
    const body = ctype.startsWith('image/') ? `(이미지 ${(await res.blob()).size}바이트)` : await res.text();
    let json = null;
    try { json = JSON.parse(body); } catch { /* 본문이 JSON이 아님 */ }
    const reason = json?.error?.errors?.[0]?.reason || '';
    return { status: res.status, ok: res.ok, ctype, body, json, reason, ms: Math.round(performance.now() - started), etag: res.headers.get('etag') };
  } catch (e) {
    return { status: 0, ok: false, ctype: '', body: String(e), json: null, reason: 'network/cors', ms: Math.round(performance.now() - started) };
  }
}
const brief = (r) => `HTTP ${r.status} ${r.reason} / Content-Type: ${r.ctype || '-'} / ${r.ms}ms / 본문: ${r.body.slice(0, 300)}`;
const auth = (extra = {}) => ({ Authorization: `Bearer ${token}`, ...extra });

// ---------- 로그인 ----------
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.onload = resolve;
    s.onerror = () => reject(new Error('구글 로그인 스크립트를 불러오지 못함'));
    document.head.appendChild(s);
  });
}
async function login() {
  try {
    await loadGis();
    const resp = await new Promise((resolve) => {
      window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: SCOPE, callback: resolve,
        error_callback: (err) => resolve({ error: err?.type || 'error' }),
      }).requestAccessToken({ prompt: 'consent' });
    });
    if (resp.error) { log('로그인', false, `${resp.error} ${resp.error_description || ''}`); return; }
    if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) { log('로그인', false, 'drive.file 권한을 허용하지 않음'); return; }
    token = resp.access_token;
    const me = await call('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', { headers: auth() });
    const email = me.json?.user?.emailAddress || '';
    const domain = email.split('@')[1] || '?';
    $('who').textContent = `로그인됨 (${domain === 'gmail.com' ? '개인 계정' : '도메인 ' + domain})`;
    log('로그인', true, `계정 종류: ${domain === 'gmail.com' ? '개인 gmail' : '워크스페이스 ' + domain}`);
    for (const id of ['t1', 't4', 't6', 't3', 't3once', 'unshare', 'cleanup', 'tAuto']) $(id).disabled = false;
  } catch (e) { log('로그인', false, String(e)); }
}

// ---------- 선생님: 만들기와 공유 ----------
async function createFile(name, mime, data) {
  const b = 'spike' + rand(16);
  const meta = JSON.stringify({ name, mimeType: mime });
  const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, data, `\r\n--${b}--`]);
  return call(`${UPLOAD}?uploadType=multipart&fields=id,name,version`, { method: 'POST', headers: auth({ 'Content-Type': `multipart/related; boundary=${b}` }), body });
}
async function share(item, id) {
  const p = await call(`${API}/${encodeURIComponent(id)}/permissions?fields=id,type,role,allowFileDiscovery`, {
    method: 'POST', headers: auth({ 'Content-Type': 'application/json' }), body: JSON.stringify(SHARE),
  });
  if (!p.ok) {
    log(item, false, `permissions.create ${brief(p)}`);
    if (p.status === 403) log(item, null, '화면 안내 예정 문구: 이 계정은 링크 공유가 허용되지 않습니다. 개인 구글 계정으로 로그인하세요');
    return null;
  }
  const l = await call(`${API}/${encodeURIComponent(id)}/permissions?fields=permissions(id,type,role,allowFileDiscovery)`, { headers: auth() });
  const found = l.json?.permissions?.find((x) => x.type === 'anyone' && x.role === 'reader' && x.allowFileDiscovery === false);
  log(item, !!found, `permissions.create HTTP ${p.status}, permissions.list: ${JSON.stringify(l.json?.permissions || l.body)}`);
  return found ? found.id : null;
}
const boardData = (rev) => JSON.stringify({ kind: 'class-board-spike', rev, writtenAt: Date.now(), title: '시험 1반', note: '가짜 데이터' });

async function test1() {
  say('1·8번 시험 중');
  const f = files();
  const c = await createFile(`board-${rand(12)}.json`, 'application/json', boardData(0));
  if (!c.ok) { log('1 파일 만들기', false, brief(c)); return say(''); }
  log('1 파일 만들기', true, `id=${c.json.id} version=${c.json.version}`);
  f.board = c.json.id; f.rev = 0; f.perm = f.perm || {};
  f.perm[c.json.id] = await share('1·8 공유', c.json.id);
  // 2번 대조용: 공유하지 않은 파일 (로그인 없이 읽으면 막혀야 함)
  const priv = await createFile(`board-${rand(12)}.json`, 'application/json', boardData(0));
  if (priv.ok) { f.priv = priv.json.id; log('2 대조 파일(공유 안 함)', null, `id=${priv.json.id}`); }
  saveFiles(f);
  showReaderUrl();
  say('');
}

async function test4make() {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 480;
  const g = canvas.getContext('2d');
  g.fillStyle = '#FBEFD5'; g.fillRect(0, 0, 800, 480);
  g.fillStyle = '#C98A1B'; g.fillRect(40, 40, 320, 400);
  g.fillStyle = '#6B4410'; g.font = '48px sans-serif'; g.fillText('SPIKE ' + new Date().toISOString().slice(11, 19), 380, 260);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  const c = await createFile(`img-${rand(12)}.jpg`, 'image/jpeg', blob);
  if (!c.ok) { log('4 이미지 만들기', false, brief(c)); return; }
  const f = files();
  f.img = c.json.id; f.perm = f.perm || {};
  f.perm[c.json.id] = await share('4 이미지 공유', c.json.id);
  saveFiles(f);
  log('4 이미지 만들기', true, `id=${c.json.id} ${blob.size}바이트`);
  showReaderUrl();
}

async function writeOnce(label) {
  const f = files();
  if (!f.board) { log(label, false, '먼저 1번 시험으로 파일을 만드세요'); return false; }
  f.rev = (f.rev || 0) + 1; saveFiles(f);
  const r = await call(`${UPLOAD}/${encodeURIComponent(f.board)}?uploadType=media&fields=id,version,modifiedTime`, {
    method: 'PATCH', headers: auth({ 'Content-Type': 'application/json' }), body: boardData(f.rev),
  });
  log(label, r.ok, r.ok ? `rev=${f.rev} 저장, version=${r.json.version}` : brief(r));
  return r.ok;
}
function test3write() {
  stop();
  let n = 0;
  const tick = async () => {
    n += 1;
    say(`3번 수정 ${n}/10 (75초 간격). 학급 PC 창에서 측정이 돌고 있어야 합니다`);
    await writeOnce(`3 수정 ${n}/10`);
    if (n >= 10) { stop(); say('3번 수정 10회 끝'); }
  };
  tick();
  timer = every(tick, 75000);
}

async function test6() {
  const f = files();
  if (!f.board) { log('6 If-Match', false, '먼저 1번 시험으로 파일을 만드세요'); return; }
  const meta = await call(`${API}/${encodeURIComponent(f.board)}?fields=version`, { headers: auth() });
  log('6 현재 버전', null, `version=${meta.json?.version} / 응답 ETag 헤더: ${meta.etag || '보이지 않음'}`);
  const r = await call(`${UPLOAD}/${encodeURIComponent(f.board)}?uploadType=media&fields=version`, {
    method: 'PATCH', headers: auth({ 'Content-Type': 'application/json', 'If-Match': '"spike-wrong-etag"' }), body: boardData(-1),
  });
  if (r.status === 412) log('6 If-Match', true, '틀린 값에 412로 거절 = 조건부 쓰기 지원');
  else if (r.ok) log('6 If-Match', false, `틀린 값인데 저장됨(version=${r.json?.version}) = If-Match 무시, rev 방식 필요`);
  else log('6 If-Match', false, `기타 응답 ${brief(r)}`);
}

async function unshare() {
  const f = files();
  for (const [id, permId] of Object.entries(f.perm || {})) {
    if (!permId) continue;
    const r = await call(`${API}/${encodeURIComponent(id)}/permissions/${encodeURIComponent(permId)}`, { method: 'DELETE', headers: auth() });
    log('공유 끊기', r.ok, `${id} HTTP ${r.status}`);
    if (r.ok) f.perm[id] = null;
  }
  saveFiles(f);
  log('공유 끊기', null, '학급 PC 창에서 [2·7 읽기 시험]을 다시 눌러 막히는지 보세요');
}

async function cleanup() {
  stop();
  const f = files();
  for (const id of [f.board, f.priv, f.img].filter(Boolean)) {
    const r = await call(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth() }); // 영구 삭제
    log('삭제', r.ok || r.status === 404, `${id} HTTP ${r.status}`);
  }
  localStorage.removeItem(FILES_STORE);
  $('readerUrl').textContent = '(삭제됨)';
}

function showReaderUrl() {
  const f = files();
  if (!f.board) return;
  const u = new URL(location.pathname, location.origin);
  u.searchParams.set('f', f.board);
  if (f.priv) u.searchParams.set('p', f.priv);
  if (f.img) u.searchParams.set('img', f.img);
  $('readerUrl').textContent = u.href;
  $('copyUrl').disabled = false;
}

// ---------- 학급 PC: 로그인 없이 읽기 ----------
function param(name) {
  const v = new URLSearchParams(location.search).get(name);
  return v && ID_RE.test(v) ? v : null; // 형식이 틀리면 요청을 보내지 않는다
}
// 본문은 다운로드 전용 주소로 받는다. /drive/v3/files?alt=media 는 자동 요청 차단 페이지(CORS 없음)를 돌려줄 때가 있다
const DOWNLOAD = 'https://www.googleapis.com/download/drive/v3/files';
const pub = (id, q) => `${q === 'alt=media' ? DOWNLOAD : API}/${encodeURIComponent(id)}?${q}&key=${encodeURIComponent(apiKey())}`;
function needKey(item) {
  if (apiKey()) return true;
  log(item, false, 'API 키가 없습니다. 위 입력칸에 넣고 [키 저장]');
  return false;
}

async function read2() {
  const f = param('f');
  if (!needKey('2 읽기')) return;
  if (!f) { log('2 읽기', false, '주소에 올바른 f= 파일 ID가 없습니다'); return; }
  log('2·7 환경', null, `페이지 버전 5, 본문 주소 ${DOWNLOAD.split('/')[3]}, 출처 ${location.origin}, 창 도구막대 보임=${window.toolbar.visible}, ${navigator.userAgent.match(/(Edg|Chrome)\/[\d.]+/g)?.join(' ') || navigator.userAgent}`);
  const m = await call(pub(f, 'fields=version,modifiedTime'));
  log('2 메타 읽기', m.ok, brief(m));
  const b = await call(pub(f, 'alt=media'));
  log('2 본문 읽기', b.ok && b.json?.kind === 'class-board-spike', brief(b));
  const nf = await call(pub(randId(), 'alt=media'));
  log('2 없는 파일', nf.status === 404 && !!nf.json, `오류 본문을 읽을 수 있는지: ${brief(nf)}`);
  const p = param('p');
  if (p) {
    const pr = await call(pub(p, 'alt=media'));
    log('2 공유 안 한 파일', !pr.ok && !!pr.json, `막혀야 정상: ${brief(pr)}`);
  }
  const nr = await call(pub(f, 'fields=version'), { referrerPolicy: 'no-referrer' });
  log('7 참조 없이 요청', nr.status === 403, `키 참조 제한이 켜져 있으면 403이어야 함: ${brief(nr)}`);
}

async function read4() {
  const id = param('img');
  if (!needKey('4 이미지')) return;
  if (!id) { log('4 이미지', false, '주소에 올바른 img= 파일 ID가 없습니다'); return; }
  $('imgs').hidden = false;
  try {
    const res = await fetch(pub(id, 'alt=media'), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const blob = await res.blob();
    $('imgBlob').onload = () => log('4 fetch→blob', true, `${blob.type} ${blob.size}바이트, 화면 표시됨`);
    $('imgBlob').onerror = () => log('4 fetch→blob', false, `받았지만 표시 못함 (${blob.type})`);
    $('imgBlob').src = URL.createObjectURL(blob);
  } catch (e) { log('4 fetch→blob', false, String(e)); }
  $('imgDirect').onload = () => log('4 img src 직접', true, '화면 표시됨');
  $('imgDirect').onerror = () => log('4 img src 직접', false, '표시 못함');
  $('imgDirect').src = pub(id, 'alt=media');
}

// 3번: 3초마다 version과 본문을 읽어, 선생님 창이 쓴 writtenAt과의 차이를 잰다 (두 창이 같은 PC여야 시계가 같다)
function read3() {
  const f = param('f');
  if (!needKey('3 측정') || !f) { if (!f) log('3 측정', false, '주소에 f= 가 없습니다'); return; }
  stop();
  let lastVersion = null; let lastWritten = null; let versionSeenAt = null;
  const delays = [];
  log('3 측정', null, '시작. 선생님 창에서 [3 반영 지연: 75초마다 10회 수정]을 누르세요');
  timer = every(async () => {
    const m = await call(pub(f, 'fields=version'));
    if (m.ok && m.json.version !== lastVersion) {
      if (lastVersion !== null) versionSeenAt = Date.now();
      lastVersion = m.json.version;
    }
    const b = await call(pub(f, 'alt=media'));
    if (!b.ok) { log('3 측정', false, brief(b)); return; }
    const w = b.json?.writtenAt;
    if (lastWritten !== null && w !== lastWritten) {
      const media = Math.round((Date.now() - w) / 1000);
      const ver = versionSeenAt ? Math.round((versionSeenAt - w) / 1000) : '?';
      delays.push(media);
      log(`3 반영 ${delays.length}회`, media <= 60, `본문 ${media}초, version ${ver}초 (3초 간격이라 ±3초)`);
      if (delays.length >= 10) {
        const max = Math.max(...delays);
        log('3 반영 지연 결과', max <= 60, `10회 최대 ${max}초, 전체 [${delays.join(', ')}]초, 목표 60초 이하`);
        stop();
      }
    }
    lastWritten = w;
    say(`3번 측정 중: ${delays.length}/10`);
  }, 3000);
}

// 5번: 학급 PC 동작 그대로 매분 version만, 바뀌면 본문. 오류는 전부 기록
function read5() {
  const f = param('f');
  if (!needKey('5 매분 확인') || !f) { if (!f) log('5 매분 확인', false, '주소에 f= 가 없습니다'); return; }
  stop();
  const start = Date.now();
  let lastVersion = null; let reqs = 0; let errs = 0; let changes = 0;
  const tick = async () => {
    const m = await call(pub(f, 'fields=version,modifiedTime')); reqs += 1;
    if (!m.ok) { errs += 1; log('5 오류', false, brief(m)); }
    else if (m.json.version !== lastVersion) {
      const b = await call(pub(f, 'alt=media')); reqs += 1;
      if (!b.ok) { errs += 1; log('5 오류', false, brief(b)); }
      else if (lastVersion !== null) changes += 1;
      lastVersion = m.json.version;
    }
    const min = Math.floor((Date.now() - start) / 60000);
    say(`5번 ${min}분 경과, 요청 ${reqs}, 오류 ${errs}, 변경 ${changes}`);
    if (min >= 10 && min % 5 === 0) log('5 매분 확인', errs === 0, `${min}분 경과, 요청 ${reqs}회, 오류 ${errs}회, 변경 감지 ${changes}회`);
  };
  tick();
  timer = every(tick, 60000);
}

// ---------- 자동 진행 (3번 측정 뒤 남은 시험을 버튼 하나로) ----------
const wait = (ms) => new Promise((r) => workerTimer(ms, r, true));
let autoRun = 0; // 멈춤을 누르면 바뀌어서 진행 중인 자동 순서가 끝난다

// 학급 PC 창: 2·4 → 매분 확인(5) → 선생님 창이 공유를 끊으면 막히는지(16절 7) 확인
async function readerAuto() {
  const f = param('f');
  if (!needKey('자동(학급 PC)') || !f) { if (!f) log('자동(학급 PC)', false, '주소에 f= 가 없습니다'); return; }
  stop();
  const run = ++autoRun;
  log('자동(학급 PC)', null, '시작. 이 창을 닫지 마세요. 약 15분 걸립니다');
  await read2();
  await read4();
  const start = Date.now();
  let lastVersion = null; let reqs = 0; let errs = 0; let changes = 0;
  while (run === autoRun && Date.now() - start < 25 * 60000) {
    const m = await call(pub(f, 'fields=version,modifiedTime')); reqs += 1;
    const min = Math.floor((Date.now() - start) / 60000);
    if (!m.ok) {
      if (min >= 10) { // 선생님 창이 11분쯤 공유를 끊는다
        log('5 매분 확인 결과', errs === 0, `${min}분 동안 요청 ${reqs - 1}회, 오류 ${errs}회, 변경 감지 ${changes}회`);
        log('공유 끊은 뒤 읽기', true, `막힘 확인: ${brief(m)}`);
        await read2();
        log('자동(학급 PC)', null, '끝. [결과 전체 복사]를 눌러 보내 주세요');
        return say('자동 끝');
      }
      errs += 1; log('5 오류', false, brief(m));
    } else if (m.json.version !== lastVersion) {
      const b = await call(pub(f, 'alt=media')); reqs += 1;
      if (!b.ok) { errs += 1; log('5 오류', false, brief(b)); } else if (lastVersion !== null) changes += 1;
      lastVersion = m.json.version;
    }
    say(`자동: 매분 확인 ${min}분 경과, 요청 ${reqs}, 오류 ${errs}, 변경 ${changes}`);
    await wait(60000);
  }
  if (run === autoRun) log('자동(학급 PC)', false, '25분 안에 공유 끊기를 못 봤습니다. 선생님 창 결과를 확인해 주세요');
}

// 선생님 창: 6 If-Match → 3분 30초마다 수정 3회(5번 변경 감지용) → 공유 끊기 → 3분 뒤 시험 파일 삭제
async function teacherAuto() {
  if (!files().board) { log('자동(선생님)', false, '먼저 1번 시험으로 파일을 만드세요'); return; }
  stop();
  const run = ++autoRun;
  log('자동(선생님)', null, '시작. 이 창을 닫지 마세요. 약 15분 걸립니다. 학급 PC 창 자동을 먼저 켰는지 확인하세요');
  await test6();
  for (let i = 1; i <= 3; i += 1) {
    say(`자동: 수정 ${i}/3 대기 중`);
    await wait(210000);
    if (run !== autoRun) return;
    await writeOnce(`5용 수정 ${i}/3`);
  }
  await wait(60000);
  if (run !== autoRun) return;
  await unshare();
  say('자동: 공유 끊음, 3분 뒤 시험 파일 삭제');
  await wait(180000);
  if (run !== autoRun) return;
  await cleanup();
  log('자동(선생님)', null, '끝. [결과 전체 복사]를 눌러 보내 주세요');
  say('자동 끝');
}

function stop() {
  autoRun += 1; if (timer) { timer.terminate(); timer = null; say('멈춤'); } }

// ---------- 시작 ----------
$('origin').textContent = location.origin;
$('mode').textContent = window.toolbar.visible ? '일반 창' : '앱 모드 또는 팝업 창 (도구막대 없음)';
$('key').value = localStorage.getItem(KEY_STORE) || '';
if (DRIVE_API_KEY) { $('key').placeholder = 'config.js의 키 사용 중'; $('key').disabled = true; }
$('ids').textContent = ['f', 'p', 'img'].map((n) => `${n}=${param(n) || '-'}`).join('  ');
showReaderUrl();
$('saveKey').onclick = () => { localStorage.setItem(KEY_STORE, $('key').value.trim()); say('키 저장됨'); };
$('login').onclick = login;
$('t1').onclick = test1;
$('t4').onclick = test4make;
$('t6').onclick = test6;
$('t3').onclick = test3write;
$('t3once').onclick = () => writeOnce('수정 1회');
$('unshare').onclick = unshare;
$('cleanup').onclick = cleanup;
$('copyUrl').onclick = () => navigator.clipboard.writeText($('readerUrl').textContent).then(() => say('주소 복사됨'));
$('tAuto').onclick = teacherAuto;
$('rAuto').onclick = readerAuto;
$('r2').onclick = read2;
$('r4').onclick = read4;
$('r3').onclick = read3;
$('r5').onclick = read5;
$('stop').onclick = stop;
$('copyLog').onclick = () => navigator.clipboard.writeText(lines.join('\n')).then(() => say('결과 복사됨. 대화창에 붙여 넣어 주세요'));
