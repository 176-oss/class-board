// 일정 탭: 날짜, 끝 날짜, 시각, 제목, 메모 (계약 2-5).
import { S, changed, rerender, today } from './state.js';
import { h, field, bindInput, button } from './ui.js';
import { randomId } from '../core/ids.js';
import { LIMITS } from '../core/schema.js';

function card(e, i) {
  const p = `events[${i}]`;
  const k = `ev:${e.id}`;
  return h('article', { class: 'card' },
    h('div', { class: 'grid3' },
      field('제목', bindInput(h('input', { type: 'text', maxLength: 40, 'data-key': `${k}:title` }), () => e.title, (v) => { e.title = v; }, changed), { path: `${p}.title`, wide: true }),
      field('날짜', bindInput(h('input', { type: 'date' }), () => e.date, (v) => { e.date = v; }, changed), { path: `${p}.date` }),
      field('끝 날짜', bindInput(h('input', { type: 'date' }), () => e.endDate, (v) => { e.endDate = v || null; }, changed), { path: `${p}.endDate`, hint: '비우면 하루' }),
      field('시각', bindInput(h('input', { type: 'time' }), () => e.time, (v) => { e.time = v; }, changed), { path: `${p}.time`, hint: '비워도 됩니다' }),
      field('메모', bindInput(h('input', { type: 'text', maxLength: 100 }), () => e.note, (v) => { e.note = v; }, changed), { path: `${p}.note`, wide: true })),
    h('div', { class: 'row-actions' }, button('삭제', () => {
      S.board.events.splice(i, 1);
      changed();
      rerender('ev:add');
    }, { kind: 'danger-ghost', ic: 'trash', key: `${k}:del` })));
}

export function render(panel) {
  const list = S.board.events;
  panel.append(
    h('h2', { text: '일정' }),
    h('div', { class: 'bar' }, button('일정 추가', () => {
      const e = { id: randomId(10), date: today(), endDate: null, time: '', title: '새 일정', note: '' };
      list.unshift(e);
      changed();
      rerender(`ev:${e.id}:title`);
    }, { kind: 'primary', ic: 'plus', key: 'ev:add', disabled: S.newer || list.length >= LIMITS.events }),
    h('span', { class: 'hint', text: '학급 PC에는 다가오는 일정 5개까지 D-day와 함께 보입니다. 지난 일정은 저절로 숨겨집니다.' })),
    list.length ? list.map(card) : h('p', { class: 'empty', text: '일정이 없습니다' }),
  );
}
