// 시간표 탭: 교시 시각표, 요일×교시 과목, 특정 날짜 변경, 방학·휴업일 (계약 2-3, 2-4). 첫 버전만 다룬다.
import { S, changed, rerender, today } from './state.js';
import { h, field, bindInput, check, button } from './ui.js';
import { defaultBoard, LIMITS } from '../core/schema.js';

const DAYS = [['mon', '월'], ['tue', '화'], ['wed', '수'], ['thu', '목'], ['fri', '금']];
const P = 'timetable[0]';

function version() {
  const b = S.board;
  if (!b.timetable.length) b.timetable.push(defaultBoard(b.title, Date.now()).timetable[0]);
  return b.timetable[0];
}

const addMin = (t, m) => {
  const v = Math.min(23 * 60 + 59, (Number(t?.slice(0, 2)) || 0) * 60 + (Number(t?.slice(3)) || 0) + m);
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};
const classNos = (v) => v.periods.filter((r) => r.kind === 'class').map((r) => r.no);

// 교시 번호를 바꾸거나 지우면 과목·날짜 변경 항목도 따라가야 검사(ref)에 걸리지 않는다.
function renumber(v, from, to) {
  for (const items of [...Object.values(v.week), ...v.overrides.map((o) => o.items)]) {
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].period !== from) continue;
      if (to === null) items.splice(i, 1);
      else items[i].period = to;
    }
  }
}

function addRow(kind) {
  const v = version();
  const last = v.periods[v.periods.length - 1];
  const start = last?.end ?? '09:00';
  const nos = classNos(v);
  v.periods.push(kind === 'class'
    ? { kind, no: nos.length ? Math.max(...nos) + 1 : 1, start, end: addMin(start, 45), label: '' }
    : { kind, no: null, start, end: addMin(start, 10), label: '쉬는 시간' });
  changed();
  rerender(`period:${v.periods.length - 1}:start`);
}

function periodsTable(v) {
  return h('table', { class: 'table' },
    h('caption', { class: 'visually-hidden', text: '교시 시각표' }),
    h('thead', {}, h('tr', {}, ['구분', '교시 또는 이름', '시작', '끝', ''].map((t) => h('th', { scope: 'col', text: t })))),
    h('tbody', {}, v.periods.map((r, i) => {
      const p = `${P}.periods[${i}]`;
      const kind = h('select', { 'aria-label': `${i + 1}행 구분`, 'data-key': `period:${i}:kind` },
        h('option', { value: 'class', text: '수업', selected: r.kind === 'class' }), h('option', { value: 'break', text: '쉬는·점심', selected: r.kind === 'break' }));
      kind.addEventListener('change', () => {
        if (kind.value === 'class') { const nos = classNos(v); Object.assign(r, { kind: 'class', no: nos.length ? Math.max(...nos) + 1 : 1, label: '' }); }
        else { renumber(v, r.no, null); Object.assign(r, { kind: 'break', no: null, label: '쉬는 시간' }); }
        changed();
        rerender();
      });
      let name;
      if (r.kind === 'class') {
        name = h('input', { type: 'number', min: 1, max: 12, value: r.no ?? '', 'aria-label': `${i + 1}행 교시 번호`, class: 'num' });
        name.addEventListener('change', () => {
          const to = name.value === '' ? undefined : Number(name.value);
          if (Number.isInteger(to) && !classNos(v).includes(to)) renumber(v, r.no, to);
          r.no = to;
          changed();
          rerender();
        });
      } else {
        name = bindInput(h('input', { type: 'text', maxLength: 10, 'aria-label': `${i + 1}행 이름` }), () => r.label, (x) => { r.label = x; }, changed);
      }
      name.dataset.path = r.kind === 'class' ? `${p}.no` : `${p}.label`;
      const cell = (el, path) => { el.dataset.path = path; el.errorEl = h('p', { class: 'field-err', hidden: true }); return h('td', {}, el, el.errorEl); };
      name.errorEl = h('p', { class: 'field-err', hidden: true });
      return h('tr', {},
        h('td', {}, kind),
        h('td', {}, name, name.errorEl),
        cell(bindInput(h('input', { type: 'time', 'aria-label': `${i + 1}행 시작`, 'data-key': `period:${i}:start` }), () => r.start, (x) => { r.start = x; }, changed), `${p}.start`),
        cell(bindInput(h('input', { type: 'time', 'aria-label': `${i + 1}행 끝` }), () => r.end, (x) => { r.end = x; }, changed), `${p}.end`),
        h('td', {}, button('삭제', () => {
          if (r.kind === 'class') renumber(v, r.no, null);
          v.periods.splice(i, 1);
          changed();
          rerender('period:addClass');
        }, { kind: 'danger-ghost', ic: 'trash', key: `period:${i}:del`, disabled: v.periods.length <= 1 })));
    })));
}

function weekGrid(v) {
  const rows = v.periods.filter((r) => r.kind === 'class' && Number.isInteger(r.no));
  return h('table', { class: 'table grid' },
    h('caption', { class: 'visually-hidden', text: '요일별 과목' }),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: '교시' }), DAYS.map(([, d]) => h('th', { scope: 'col', text: d })))),
    h('tbody', {}, rows.map((r) => h('tr', {}, h('th', { scope: 'row', text: `${r.no}교시` }), DAYS.map(([wd, d]) => {
      const list = v.week[wd];
      const input = h('input', { type: 'text', maxLength: 20, 'aria-label': `${d}요일 ${r.no}교시 과목`, value: list.find((x) => x.period === r.no)?.subject ?? '' });
      const setPath = () => { const j = list.findIndex((x) => x.period === r.no); if (j >= 0) input.dataset.path = `${P}.week.${wd}[${j}].subject`; };
      setPath();
      input.errorEl = h('p', { class: 'field-err', hidden: true });
      // 비워도 항목을 지우지 않는다: 지우면 뒤 항목의 경로 번호가 밀린다. subject '' 는 '표시 안 함'.
      input.addEventListener('input', () => {
        const it = list.find((x) => x.period === r.no);
        if (it) it.subject = input.value;
        else { list.push({ period: r.no, subject: input.value, note: '' }); setPath(); }
        changed();
      });
      return h('td', {}, input, input.errorEl);
    })))));
}

function overrideCard(v, o, oi) {
  const p = `${P}.overrides[${oi}]`;
  const nos = classNos(v);
  return h('article', { class: 'card' },
    h('div', { class: 'grid2' },
      field('날짜', bindInput(h('input', { type: 'date', 'data-key': `ov:${oi}:date` }), () => o.date, (x) => { o.date = x; }, changed), { path: `${p}.date` }),
      check('하루 전체 바꾸기 (적은 교시만 남김)', () => o.replaceAll, (x) => { o.replaceAll = x; }, changed)),
    o.items.length ? h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['교시', '과목 (비우면 그 교시 없음)', '메모', ''].map((t) => h('th', { scope: 'col', text: t })))),
      h('tbody', {}, o.items.map((it, ii) => {
        const ip = `${p}.items[${ii}]`;
        const sel = h('select', { 'aria-label': '교시', 'data-path': `${ip}.period` }, nos.map((n) => h('option', { value: n, text: `${n}교시`, selected: it.period === n })));
        sel.errorEl = h('p', { class: 'field-err', hidden: true });
        sel.addEventListener('change', () => { it.period = Number(sel.value); changed(); });
        const sub = bindInput(h('input', { type: 'text', maxLength: 20, 'aria-label': '과목', 'data-path': `${ip}.subject` }), () => it.subject, (x) => { it.subject = x; }, changed);
        sub.errorEl = h('p', { class: 'field-err', hidden: true });
        const note = bindInput(h('input', { type: 'text', maxLength: 20, 'aria-label': '메모', 'data-path': `${ip}.note` }), () => it.note, (x) => { it.note = x; }, changed);
        note.errorEl = h('p', { class: 'field-err', hidden: true });
        return h('tr', {}, h('td', {}, sel, sel.errorEl), h('td', {}, sub, sub.errorEl), h('td', {}, note, note.errorEl),
          h('td', {}, button('빼기', () => { o.items.splice(ii, 1); changed(); rerender(`ov:${oi}:add`); }, { kind: 'danger-ghost', ic: 'trash' })));
      }))) : null,
    h('div', { class: 'row-actions' },
      button('교시 추가', () => {
        const free = nos.find((n) => !o.items.some((x) => x.period === n));
        if (free === undefined) return;
        o.items.push({ period: free, subject: '', note: '' });
        changed();
        rerender(`ov:${oi}:add`);
      }, { ic: 'plus', key: `ov:${oi}:add` }),
      button('이 날짜 변경 삭제', () => { v.overrides.splice(oi, 1); changed(); rerender('ov:new'); }, { kind: 'danger-ghost', ic: 'trash' })));
}

function noClassCard(n, i) {
  const p = `noClass[${i}]`;
  return h('article', { class: 'card' }, h('div', { class: 'grid3' },
    field('이름', bindInput(h('input', { type: 'text', maxLength: 20, 'data-key': `nc:${i}:label` }), () => n.label, (x) => { n.label = x; }, changed), { path: `${p}.label` }),
    field('시작일', bindInput(h('input', { type: 'date' }), () => n.startDate, (x) => { n.startDate = x; }, changed), { path: `${p}.startDate` }),
    field('종료일', bindInput(h('input', { type: 'date' }), () => n.endDate, (x) => { n.endDate = x; }, changed), { path: `${p}.endDate`, hint: '하루짜리는 시작일과 같게' })),
  h('div', { class: 'row-actions' }, button('삭제', () => { S.board.noClass.splice(i, 1); changed(); rerender('nc:new'); }, { kind: 'danger-ghost', ic: 'trash' })));
}

export function render(panel) {
  const v = version();
  const b = S.board;
  panel.append(
    h('h2', { text: '시간표' }),
    h('section', { class: 'sec' }, h('h3', { text: '교시 시각' }),
      h('p', { class: 'hint', text: '시작은 끝보다 앞서야 하고, 다음 행의 시작은 앞 행의 끝과 같거나 늦어야 합니다. 어기면 저장되지 않습니다.' }),
      h('div', { class: 'scroll-x' }, periodsTable(v)),
      h('div', { class: 'row-actions' },
        button('수업 교시 추가', () => addRow('class'), { ic: 'plus', key: 'period:addClass', disabled: v.periods.length >= LIMITS.periodRows }),
        button('쉬는·점심 추가', () => addRow('break'), { ic: 'plus', disabled: v.periods.length >= LIMITS.periodRows }))),
    h('section', { class: 'sec' }, h('h3', { text: '요일별 과목' }),
      h('p', { class: 'hint', text: '과목을 비운 교시는 학급 PC에 보이지 않습니다.' }),
      h('div', { class: 'scroll-x' }, weekGrid(v))),
    h('section', { class: 'sec' }, h('h3', { text: '특정 날짜 변경' }),
      v.overrides.map((o, oi) => overrideCard(v, o, oi)),
      button('날짜 변경 추가', () => {
        v.overrides.push({ date: today(), replaceAll: false, items: [] });
        changed();
        rerender(`ov:${v.overrides.length - 1}:date`);
      }, { ic: 'plus', key: 'ov:new' })),
    h('section', { class: 'sec' }, h('h3', { text: '방학·휴업일' }),
      h('p', { class: 'hint', text: '공휴일도 여기에 넣습니다. 이 기간에는 시간표 대신 이름이 크게 보입니다.' }),
      b.noClass.map(noClassCard),
      button('방학·휴업일 추가', () => {
        b.noClass.push({ startDate: today(), endDate: today(), label: '휴업일' });
        changed();
        rerender(`nc:${b.noClass.length - 1}:label`);
      }, { ic: 'plus', key: 'nc:new', disabled: b.noClass.length >= LIMITS.noClass })),
  );
}
