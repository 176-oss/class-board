// 청소당번 탭: 구역, 학생 번호, 이름 표시 방식, 순환/고정, 오늘 교체 (계약 2-8, 3-6, 10-2).
// 학생 이름은 S.names(메모리)에만 있고 number 모드에서는 어디에도 들어가지 않는다.
import { S, changed, rerender, today } from './state.js';
import { h, field, bindInput, button, radios, confirmBox } from './ui.js';
import { randomId } from '../core/ids.js';
import { LIMITS } from '../core/schema.js';
import { dutyFor } from '../core/duty.js';
import { withNames, parseNumbers } from '../core/edit.js';

const DAYS = [['mon', '월'], ['tue', '화'], ['wed', '수'], ['thu', '목'], ['fri', '금']];
const NAME_HINT = {
  number: '이 PC 화면에서만 보이고 저장되지 않습니다',
  masked: '김○○처럼 가려서 저장합니다. 같은 성을 가진 학생이 여러 명이면 구별되지 않을 수 있습니다',
  full: '전체 이름이 저장되어 학급 PC에 보입니다. 링크가 새면 학생 이름이 공개됩니다',
};

// 지운 번호·구역을 가리키던 고정 배정과 교체를 함께 지운다 (검사 ref 오류 방지).
function prune(d) {
  const nos = new Set(d.students.map((s) => s.no));
  const zones = new Set(d.zones.map((z) => z.id));
  if (d.fixed) for (const wd of Object.keys(d.fixed)) {
    for (const zid of Object.keys(d.fixed[wd])) {
      if (!zones.has(zid)) delete d.fixed[wd][zid];
      else d.fixed[wd][zid] = d.fixed[wd][zid].filter((n) => nos.has(n));
    }
  }
  d.swaps = d.swaps.filter((s) => zones.has(s.zoneId) && (s.to === null || nos.has(s.to)));
}

async function pickNameMode(v) {
  const d = S.board.duty;
  if (v === 'full' && !(await confirmBox('이름 전체 표시', '링크가 새면 학생 이름이 공개됩니다. 그래도 켤까요?', '전체 이름 켜기', { danger: true }))) return false;
  if (v === 'masked' && !(await confirmBox('가린 이름 표시',
    '가린 이름(김○○)이 게시판 파일에 들어가 링크를 아는 사람은 볼 수 있습니다. 같은 성을 가진 학생이 여러 명이면 구별되지 않을 수 있습니다. 켤까요?', '가린 이름 켜기'))) return false;
  d.nameMode = v;
  changed();
  rerender(`dutyName:${v}`);
  return true;
}

function zonesSection(d) {
  return h('section', { class: 'sec' }, h('h3', { text: '구역' }),
    d.zones.map((z, i) => h('div', { class: 'inline' },
      field(`구역 ${i + 1} 이름`, bindInput(h('input', { type: 'text', maxLength: 20, 'data-key': `zone:${z.id}` }), () => z.name, (v) => { z.name = v; }, changed), { path: `duty.zones[${i}].name` }),
      button('삭제', () => { d.zones.splice(i, 1); prune(d); changed(); rerender('zone:add'); }, { kind: 'danger-ghost', ic: 'trash' }))),
    button('구역 추가', () => {
      const z = { id: randomId(10), name: d.zones.length ? `구역 ${d.zones.length + 1}` : '교실' };
      d.zones.push(z);
      changed();
      rerender(`zone:${z.id}`);
    }, { ic: 'plus', key: 'zone:add', disabled: d.zones.length >= LIMITS.zones }));
}

function studentsSection(d) {
  const count = h('input', { type: 'number', min: 1, max: LIMITS.students, value: d.students.length || '', class: 'num' });
  return h('section', { class: 'sec' }, h('h3', { text: '학생 번호' }),
    h('div', { class: 'inline' },
      field('학생 수', count, { hint: '1번부터 이 수까지 번호를 한 번에 만듭니다' }),
      button('번호 만들기', () => {
        const n = Math.min(LIMITS.students, Math.max(0, Math.floor(Number(count.value) || 0)));
        d.students = Array.from({ length: n }, (_, i) => ({ no: i + 1 }));
        prune(d);
        changed();
        rerender('students:make');
      }, { key: 'students:make' })),
    d.students.length ? h('div', { class: 'students' }, d.students.map((s, i) => {
      // 브라우저가 입력 기록으로 남기지 않게 자동 완성을 끈다.
      const name = h('input', { type: 'text', maxLength: 10, autocomplete: 'off', spellcheck: false, 'data-key': `student:${s.no}` });
      bindInput(name, () => S.names.get(s.no), (v) => { if (v.trim()) S.names.set(s.no, v); else S.names.delete(s.no); }, changed);
      return h('div', { class: 'student' },
        field(`${s.no}번 이름`, name, { path: `duty.students[${i}].name` }),
        button(`${s.no}번 빼기`, () => { d.students.splice(i, 1); S.names.delete(s.no); prune(d); changed(); rerender('students:make'); }, { kind: 'danger-ghost', ic: 'trash' }));
    })) : null,
    h('p', { class: 'hint', text: `이름 칸: ${NAME_HINT[d.nameMode]}` }));
}

function assignSection(d) {
  const t = today();
  d.rotate ??= { startDate: t, unit: 'week', perZone: 1 };
  const sec = h('section', { class: 'sec' }, h('h3', { text: '배정 방식' }),
    radios('배정 방식', 'dutyMode', [['rotate', '순환', '번호 순서대로 밀립니다'], ['fixed', '요일별 고정']], () => d.mode, (v) => {
      d.mode = v;
      if (v === 'fixed') d.fixed ??= Object.fromEntries(DAYS.map(([wd]) => [wd, {}]));
      changed();
      rerender(`dutyMode:${v}`);
    }));
  if (d.mode === 'rotate') {
    const r = d.rotate;
    sec.append(h('div', { class: 'grid3' },
      field('시작일', bindInput(h('input', { type: 'date' }), () => r.startDate, (v) => { r.startDate = v; }, changed), { path: 'duty.rotate.startDate' }),
      radios('바뀌는 단위', 'dutyUnit', [['week', '한 주마다'], ['day', '하루마다 (평일)']], () => r.unit, (v) => { r.unit = v; changed(); }),
      field('구역당 인원', bindInput(h('input', { type: 'number', min: 1, max: 10, class: 'num' }), () => r.perZone, (v) => { r.perZone = v === '' ? undefined : Number(v); }, changed),
        { path: 'duty.rotate.perZone', hint: '구역 수 x 구역당 인원은 학생 수 이하' })));
  } else {
    d.fixed ??= Object.fromEntries(DAYS.map(([wd]) => [wd, {}]));
    sec.append(d.zones.length ? h('div', { class: 'scroll-x' }, h('table', { class: 'table' },
      h('caption', { class: 'visually-hidden', text: '요일별 고정 당번' }),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: '구역' }), DAYS.map(([, l]) => h('th', { scope: 'col', text: l })))),
      h('tbody', {}, d.zones.map((z) => h('tr', {}, h('th', { scope: 'row', text: z.name }), DAYS.map(([wd, l]) => {
        const input = h('input', { type: 'text', inputMode: 'numeric', 'aria-label': `${l}요일 ${z.name} 번호`, 'data-path': `duty.fixed.${wd}.${z.id}`, value: (d.fixed[wd]?.[z.id] ?? []).join(', ') });
        input.errorEl = h('p', { class: 'field-err', hidden: true });
        input.addEventListener('input', () => {
          d.fixed[wd] ??= {};
          d.fixed[wd][z.id] = parseNumbers(input.value);
          changed();
        });
        return h('td', {}, input, input.errorEl);
      })))))) : h('p', { class: 'empty', text: '구역을 먼저 넣으세요' }),
    h('p', { class: 'hint', text: '번호를 쉼표로 나눠 적습니다. 예: 3, 7, 12' }));
  }
  return sec;
}

function swapSection(d) {
  const t = today();
  const view = dutyFor(withNames(d, S.names), t, d.swaps);
  const todays = d.swaps.filter((s) => s.date === t);
  const sec = h('section', { class: 'sec' }, h('h3', { text: '오늘 하루 교체 (결석 등)' }));
  if (view.status !== 'ok') {
    sec.append(h('p', { class: 'empty', text: view.status === 'weekend' ? '오늘은 주말입니다' : view.status === 'before' ? `순환 시작일(${view.startDate}) 전입니다` : '구역과 학생 번호를 먼저 넣으세요' }));
    return sec;
  }
  for (const z of view.zones) {
    sec.append(h('div', { class: 'card' }, h('p', {}, h('strong', { text: `${z.name}: ` }), z.students.map((s) => s.label).join(', ') || '없음'),
      z.students.map((s) => {
        const others = d.students.filter((x) => x.no !== s.no);
        const sel = h('select', { 'aria-label': `${s.no}번 대신 할 번호` }, others.map((x) => h('option', { value: x.no, text: `${x.no}번` })));
        return h('div', { class: 'inline' },
          h('span', { class: 'who', text: `${s.no}번` }),
          button('이 번호 빼기', () => { d.swaps.push({ date: t, zoneId: z.id, from: s.no, to: null }); changed(); rerender('swap:undo'); }, { key: `swap:${z.id}:${s.no}:out` }),
          sel,
          button('바꾸기', () => { d.swaps.push({ date: t, zoneId: z.id, from: s.no, to: Number(sel.value) }); changed(); rerender('swap:undo'); }, { disabled: !others.length }));
      })));
  }
  if (todays.length) {
    sec.append(h('p', { class: 'hint', text: `오늘 교체 ${todays.length}건. 내일이 되면 저장할 때 저절로 지워집니다.` }),
      button('오늘 교체 모두 취소', () => { d.swaps = d.swaps.filter((s) => s.date !== t); changed(); rerender(); }, { key: 'swap:undo' }));
  }
  return sec;
}

export function render(panel) {
  const d = S.board.duty;
  panel.append(
    h('h2', { text: '청소당번' }),
    zonesSection(d),
    studentsSection(d),
    h('section', { class: 'sec' }, h('h3', { text: '이름 표시 방식' }),
      radios('학급 PC에 보이는 모양', 'dutyName', [
        ['number', '번호만 (기본, 가장 안전)', NAME_HINT.number],
        ['masked', '가린 이름 (3번 김○○)', NAME_HINT.masked],
        ['full', '전체 이름 (3번 김하늘)', NAME_HINT.full],
      ], () => d.nameMode, pickNameMode)),
    assignSection(d),
    swapSection(d),
    h('section', { class: 'sec' }, field('메모', bindInput(h('input', { type: 'text', maxLength: 100 }), () => d.note, (v) => { d.note = v; }, changed), { path: 'duty.note', wide: true })),
  );
}
