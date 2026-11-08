// 입력 화면 DOM 도구: 요소 만들기, 입력 칸, 대화상자, 알림. 글은 모두 textContent 로만 넣는다.

let seq = 0;
export const uid = (p = 'f') => `${p}${++seq}`;

// props: class, text, data-*, aria-*, on<이벤트>, 그 밖은 속성으로.
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'role' || k === 'for') el.setAttribute(k, v === true ? '' : v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
// 단색 선 아이콘. d 는 24x24 경로.
export function icon(d) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', 'ic');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  s.append(p);
  return s;
}
export const ICONS = {
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  plus: 'M12 5v14M5 12h14',
  save: 'M5 4h11l3 3v13H5zM8 4v5h8M8 20v-6h8v6',
  stop: 'M6 6h12v12H6z',
};

export function button(label, onclick, { kind = '', ic = '', key = '', disabled = false, title } = {}) {
  return h('button', { type: 'button', class: `btn ${kind}`.trim(), onclick, 'data-key': key || undefined, disabled, title },
    ic ? icon(ICONS[ic]) : null, h('span', { text: label }));
}

// 칸 하나: 라벨, 입력, 도움말, 오류 자리. 입력에 data-path 를 달아 검사 오류를 옆에 보인다.
export function field(label, input, { hint = '', path = '', wide = false } = {}) {
  input.id ||= uid();
  const err = h('p', { class: 'field-err', id: uid('e'), hidden: true });
  const hintEl = hint ? h('p', { class: 'hint', id: uid('h'), text: hint }) : null;
  input.setAttribute('aria-describedby', [hintEl?.id, err.id].filter(Boolean).join(' '));
  if (path) input.dataset.path = path;
  input.errorEl = err;
  return h('div', { class: wide ? 'field wide' : 'field' }, h('label', { for: input.id, text: label }), input, hintEl, err);
}

// 값 묶기: 입력이 바뀌면 set(값) 후 changed().
export function bindInput(input, get, set, changed, { parse = (v) => v } = {}) {
  input.value = get() ?? '';
  input.addEventListener('input', () => { set(parse(input.value)); changed(); });
  return input;
}

export function check(label, get, set, changed, { key } = {}) {
  const input = h('input', { type: 'checkbox', checked: !!get(), 'data-key': key });
  input.addEventListener('change', () => { set(input.checked); changed(); });
  const id = uid();
  input.id = id;
  return h('div', { class: 'check' }, input, h('label', { for: id, text: label }));
}

// 라디오 묶음. options: [[값, 라벨, 설명?]]. onpick 이 false 를 돌려주면 되돌린다.
export function radios(legend, name, options, get, onpick) {
  const box = h('fieldset', { class: 'radios' }, h('legend', { text: legend }));
  for (const [value, label, desc] of options) {
    const id = uid();
    const input = h('input', { type: 'radio', name, value, id, checked: get() === value, 'data-key': `${name}:${value}` });
    input.addEventListener('change', async () => {
      if (!input.checked) return;
      const prev = get();
      if ((await onpick(value)) === false) {
        for (const r of box.querySelectorAll('input')) r.checked = r.value === prev;
      }
    });
    box.append(h('div', { class: 'radio' }, input, h('label', { for: id }, h('span', { text: label }), desc ? h('span', { class: 'hint', text: desc }) : null)));
  }
  return box;
}

const live = () => document.getElementById('live');
export function say(text, { error = false } = {}) {
  const el = live();
  el.classList.toggle('is-error', error);
  // 같은 글을 다시 넣어도 읽히게 비웠다가 넣는다.
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 30);
}

// 네이티브 dialog: showModal 이 바깥을 막아 포커스를 가두고 Esc 는 cancel 로 닫힌다.
// actions: [{ label, value, kind }]. 돌려줌: 누른 value, Esc 면 null.
export function dialog({ title, body = [], actions = [{ label: '닫기', value: 'close' }], setup } = {}) {
  const back = document.activeElement;
  const titleId = uid('d');
  const dlg = h('dialog', { class: 'dlg', 'aria-labelledby': titleId });
  let finish;
  const btns = actions.map((a) => h('button', { type: 'button', class: `btn ${a.kind ?? ''}`.trim(), text: a.label, onclick: () => finish(a.value) }));
  dlg.append(h('h2', { id: titleId, text: title }), h('div', { class: 'dlg-body' }, body), h('div', { class: 'dlg-actions' }, btns));
  document.body.append(dlg);
  setup?.(dlg, btns);
  return new Promise((resolve) => {
    // close 이벤트는 화면이 그려질 때까지 늦춰질 수 있어 직접 끝낸다.
    finish = (v) => {
      if (!dlg.isConnected) return;
      dlg.close();
      dlg.remove();
      if (back?.isConnected) back.focus();
      resolve(v);
    };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
    dlg.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); finish(null); } });
    dlg.showModal();
    (dlg.querySelector('input, textarea, select') ?? btns[0])?.focus();
  });
}

export async function confirmBox(title, text, okLabel, { danger = false } = {}) {
  const v = await dialog({
    title,
    body: [h('p', { text })],
    actions: [{ label: '취소', value: 'no' }, { label: okLabel, value: 'yes', kind: danger ? 'danger' : 'primary' }],
  });
  return v === 'yes';
}
