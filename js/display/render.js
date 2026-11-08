// 표시 화면 그리기 (계약 10-1). DOM만 만들고 fetch·저장소를 쓰지 않아 입력 화면 미리보기도 그대로 쓴다.
import { PALETTES } from '../core/palette.js';
import { seoulNow } from '../core/time.js';
import { todayTimetable } from '../core/timetable.js';
import { activeNotices, pageNotices, richLines } from '../core/notices.js';
import { eventsView } from '../core/events.js';
import { dutyFor } from '../core/duty.js';

const VARS = { bg: '--b-bg', surface: '--b-surface', text: '--b-text', muted: '--b-muted', accent: '--b-accent', fill: '--b-fill',
  onFill: '--b-on-fill', title: '--b-title', warn: '--b-warn', line: '--b-line' };
const WEEKDAY = { mon: '월요일', tue: '화요일', wed: '수요일', thu: '목요일', fri: '금요일', sat: '토요일', sun: '일요일' };
const BLOCK_NAME = { timetable: '오늘 시간표', notices: '안내', events: '일정', duty: '청소당번' };

function h(tag, cls, ...kids) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : String(k));
  return el;
}

const monthDay = (date) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

export function applyPalette(el, name) {
  const p = PALETTES[name] ?? PALETTES.honey;
  for (const [k, v] of Object.entries(VARS)) el.style.setProperty(v, p[k]);
}

// 넘치면 그 칸의 글자만 조금씩 줄인다 (최악 데이터에서도 잘리지 않게).
// 한 줄짜리 학급 이름은 글자 윗부분이 1px 넘쳐 보이므로 너비만 본다.
function fit(el, widthOnly = false, min = 0.45) {
  let f = 1;
  el.style.setProperty('--fit', '1');
  while (((!widthOnly && el.scrollHeight > el.clientHeight + 1) || el.scrollWidth > el.clientWidth + 1) && f > min) {
    f = Math.round((f - 0.05) * 100) / 100;
    el.style.setProperty('--fit', String(f));
  }
}

function foot(notes, badge) {
  const el = h('div', 'cb-foot');
  if (badge) el.append(h('div', 'cb-badge', badge));
  if (notes.length) el.append(h('div', 'cb-warns', notes.map((t) => h('div', '', t))));
  return el;
}

function prepare(root, palette, fontScale) {
  root.replaceChildren();
  root.className = 'cb-board';
  applyPalette(root, palette);
  root.style.setProperty('--fs', String(fontScale));
}

// 연결 중, 주소 오류, 설정 필요 화면.
export function renderMessage(root, title, sub = '', { notes = [], badge = '' } = {}) {
  prepare(root, 'honey', 1);
  root.append(h('div', 'cb-center', h('div', 'cb-center-title', title), sub ? h('div', 'cb-center-sub', sub) : null), foot(notes, badge));
}

function timetableBlock(board, nowMs) {
  const tt = todayTimetable(board, nowMs);
  const el = h('section', 'cb-box cb-block', h('div', 'cb-head', BLOCK_NAME.timetable));
  if (tt.status === 'noClass' || tt.status === 'weekend') {
    el.append(h('div', 'cb-day-label', tt.label));
    return el;
  }
  if (tt.status === 'none') {
    el.append(h('div', 'cb-empty', '오늘 시간표가 없습니다'));
    return el;
  }
  el.append(h('div', 'cb-tt-list', tt.rows.map((r) => {
    const time = `${r.start}~${r.end}`;
    if (r.kind === 'break') return h('div', `cb-period cb-break cb-${r.state}`, h('span', 'cb-no', r.label), h('span', 'cb-time', time));
    return h('div', `cb-period cb-${r.state}`,
      h('span', 'cb-no', r.label),
      h('span', 'cb-sub', r.subject, r.state === 'next' ? h('span', 'cb-next-mark', '다음') : null),
      h('span', 'cb-time', r.note ? `${time}  ${r.note}` : time));
  })));
  return el;
}

function noticeItem(n) {
  return h('article', '',
    h('div', 'cb-notice-title', n.important ? h('span', 'cb-tag', '중요') : null, n.title),
    n.body ? h('div', 'cb-notice-body', richLines(n.body).map((line) =>
      h('p', '', line.length ? line.map((s) => (s.bold ? h('strong', '', s.text) : s.text)) : ' '))) : null);
}

function noticesBlock(board, list, paged, pageIndex, imageUrl) {
  const el = h('section', 'cb-box cb-block');
  const head = h('div', 'cb-head', BLOCK_NAME.notices);
  el.append(head);
  if (!paged.pages.length) {
    el.append(h('div', 'cb-empty', '오늘 안내가 없습니다'));
    return el;
  }
  const page = paged.pages[pageIndex];
  if (paged.pages.length > 1) head.append(h('span', 'cb-page', `${pageIndex + 1} / ${paged.pages.length}`));
  const items = h('div', 'cb-notice-list', page.items.map(noticeItem));
  const withImage = page.items.find((n) => n.imageId);
  if (!withImage) {
    el.append(items);
    return el;
  }
  const img = board.images.find((i) => i.id === withImage.imageId);
  const alt = withImage.imageAlt || img?.alt || '';
  const url = img ? imageUrl(img.fileId) : null;
  let fig;
  if (url) {
    const tag = document.createElement('img');
    tag.src = url;
    tag.alt = alt;
    fig = h('figure', 'cb-figure', tag);
  } else {
    fig = h('figure', 'cb-figure', h('div', 'cb-alt', alt || '그림을 불러오지 못했습니다'));
  }
  el.append(h('div', 'cb-with-image', items, fig));
  return el;
}

function eventsBlock(board, date) {
  const v = eventsView(board, date, 5);
  const el = h('section', 'cb-box cb-block', h('div', 'cb-head', BLOCK_NAME.events));
  if (!v.items.length) {
    el.append(h('div', 'cb-empty', '다가오는 일정이 없습니다'));
    return el;
  }
  el.append(h('div', 'cb-events', v.items.map((e) => {
    let when = e.endDate && e.endDate !== e.date ? `${monthDay(e.date)}~${monthDay(e.endDate)}` : monthDay(e.date);
    if (e.time) when += ' ' + e.time;
    return h('div', 'cb-event', h('span', 'cb-dday', e.dday), h('span', '', e.title, h('span', 'cb-when', when)));
  }), v.more ? h('div', 'cb-more', `외 ${v.more}건`) : null));
  return el;
}

function dutyBlock(board, date) {
  const d = dutyFor(board.duty, date);
  if (d.status === 'weekend' || d.status === 'none') return null;
  const el = h('section', 'cb-box cb-block', h('div', 'cb-head', BLOCK_NAME.duty));
  if (d.status === 'before') {
    el.append(h('div', '', `청소당번은 ${monthDay(d.startDate)}부터`));
    return el;
  }
  el.append(h('div', 'cb-zones', d.zones.map((z) =>
    h('div', '', h('span', 'cb-zone-name', `${z.name}: `),
      z.students.length ? z.students.map((s, i) => [i ? ', ' : '', h('span', 'cb-nowrap', s.label)]) : '없음'))));
  if (board.duty.note) el.append(h('div', 'cb-note', board.duty.note));
  return el;
}

// ctx: nowMs, page(몇 번째 안내 페이지), imageUrl(fileId → 주소 또는 null), notes(구석 경고 줄), badge(구석 왼쪽 글).
// 돌려줌: { pageCount, pageSec } 안내 넘기기 예약용.
export function renderBoard(root, board, ctx = {}) {
  const { nowMs = Date.now(), page = 0, imageUrl = () => null, notes = [], badge = '' } = ctx;
  const d = board.design;
  const today = seoulNow(nowMs);
  prepare(root, d.palette, d.fontScale);

  if (d.background.kind === 'image') {
    const img = board.images.find((i) => i.id === d.background.imageId);
    const url = img ? imageUrl(img.fileId) : null;
    if (url) {
      const bg = h('div', 'cb-bgimg');
      bg.style.backgroundImage = `url("${url}")`;
      const ov = h('div', 'cb-overlay');
      ov.style.opacity = String(d.background.overlay);
      root.append(bg, ov);
    }
  }

  const title = h('div', 'cb-title', board.title);
  root.append(h('header', 'cb-box cb-top', title,
    h('div', 'cb-date', `${monthDay(today.date)} ${WEEKDAY[today.weekday]}`),
    d.showClock ? h('div', 'cb-clock', today.time) : null));

  const list = activeNotices(board, today.date);
  const paged = pageNotices(list, { rotateSec: d.rotateSec, fontScale: d.fontScale });
  const blocks = d.layout.blocks;
  if (blocks.notices && paged.pinned.length) {
    root.append(h('div', 'cb-box cb-pinned', paged.pinned.map((n) => h('div', '', h('span', 'cb-tag', '중요'), n.title))));
  }

  const main = h('div', d.layout.timetable === 'right' ? 'cb-main cb-tt-right' : 'cb-main');
  const fits = [title];
  if (blocks.timetable) {
    const tt = timetableBlock(board, nowMs);
    tt.dataset.block = 'timetable';
    main.append(tt);
    fits.push(tt);
  }

  const pageIndex = paged.pages.length ? ((page % paged.pages.length) + paged.pages.length) % paged.pages.length : 0;
  const made = {
    notices: () => blocks.notices && noticesBlock(board, list, paged, pageIndex, imageUrl),
    events: () => blocks.events && eventsBlock(board, today.date),
    duty: () => blocks.duty && dutyBlock(board, today.date),
  };
  const rest = h('div', 'cb-rest');
  let row = null;
  let prev = null;
  for (const name of d.layout.order) {
    const el = made[name]();
    if (!el) continue;
    el.dataset.block = name;
    fits.push(el);
    // events 와 duty 가 이웃이면 한 줄에 나란히 둔다.
    const pair = row && ((prev === 'events' && name === 'duty') || (prev === 'duty' && name === 'events'));
    if (!pair) {
      row = h('div', name === 'notices' ? 'cb-row cb-grow' : 'cb-row');
      rest.append(row);
    }
    row.append(el);
    prev = name;
  }
  if (!rest.querySelector('[data-block="notices"]')) rest.classList.add('cb-even');
  if (rest.childElementCount) main.append(rest);
  root.append(main, foot(notes, badge));

  for (const el of fits) fit(el, el === title);
  const cur = paged.pages[pageIndex];
  return { pageCount: paged.pages.length, pageSec: cur ? cur.sec : d.rotateSec };
}
