// 디자인 탭: 학급 이름, 색 묶음, 글자 크기, 배치, 배경, 전환 시간, 시계 (계약 2-2, 기획서 10절).
import { S, changed, rerender } from './state.js';
import { h, field, bindInput, check, button, radios, uid } from './ui.js';
import { imageName } from './tab-images.js';
import { PALETTES, checkPalette } from '../core/palette.js';
import { DEFAULT_DESIGN } from '../core/schema.js';
import { moveItem } from '../core/edit.js';

const PALETTE_NAME = { honey: '꿀색 (기본)', brown: '짙은 갈색', sand: '연한 모래', night: '짙은 바탕' };
const BLOCK_NAME = { timetable: '시간표', notices: '안내', events: '일정', duty: '청소당번' };

function range(label, get, set, { min, max, step, fmt, path }) {
  const out = h('output', { text: fmt(get()) });
  const input = h('input', { type: 'range', min, max, step, value: get(), 'data-key': path });
  input.addEventListener('input', () => { set(Number(input.value)); out.textContent = fmt(get()); changed(); });
  const f = field(label, input, { path });
  f.querySelector('label').append(' ', out);
  return f;
}

function palettes(d) {
  const box = h('fieldset', { class: 'radios palettes' }, h('legend', { text: '색 묶음' }));
  for (const [name, p] of Object.entries(PALETTES)) {
    const id = uid();
    const res = checkPalette(p);
    const min = Math.min(...res.pairs.map((x) => x.ratio));
    const input = h('input', { type: 'radio', name: 'palette', value: name, id, checked: d.palette === name, 'data-key': `palette:${name}` });
    input.addEventListener('change', () => { d.palette = name; changed(); });
    const sw = h('span', { class: 'swatch', 'aria-hidden': 'true' });
    for (const k of ['bg', 'surface', 'fill', 'text']) sw.append(h('span', { style: `background:${p[k]}` }));
    box.append(h('div', { class: 'radio' }, input, h('label', { for: id }, sw, h('span', { text: PALETTE_NAME[name] }),
      h('span', { class: res.ok ? 'pass' : 'fail', text: res.ok ? `글자 대비 검사 통과 (가장 낮은 값 ${min.toFixed(2)}:1)` : `글자 대비 부족 (${min.toFixed(2)}:1)` }))));
  }
  return box;
}

function order(d) {
  const list = d.layout.order;
  return h('fieldset', { class: 'radios' }, h('legend', { text: '칸 순서 (시간표 옆 영역, 위에서 아래로)' }),
    h('ol', { class: 'order' }, list.map((name, i) => h('li', {}, h('span', { class: 'grow', text: BLOCK_NAME[name] }),
      button('위로', () => { d.layout.order = moveItem(list, i, -1); changed(); rerender(`order:${name}:up`); }, { ic: 'up', key: `order:${name}:up`, disabled: i === 0 }),
      button('아래로', () => { d.layout.order = moveItem(list, i, 1); changed(); rerender(`order:${name}:down`); }, { ic: 'down', key: `order:${name}:down`, disabled: i === list.length - 1 })))));
}

export function render(panel) {
  const b = S.board;
  const d = b.design;
  const bgImg = h('select', { 'data-key': 'bg:img', disabled: !b.images.length }, b.images.map((im) => h('option', { value: im.id, text: imageName(im), selected: d.background.imageId === im.id })));
  bgImg.addEventListener('change', () => { d.background.imageId = bgImg.value; changed(); });
  panel.append(
    h('h2', { text: '디자인' }),
    field('학급 이름 (화면 맨 위)', bindInput(h('input', { type: 'text', maxLength: 40, 'data-key': 'title' }), () => b.title, (v) => { b.title = v; }, changed), { path: 'title', hint: '예: 3학년 2반. 학생 이름은 넣지 마세요' }),
    palettes(d),
    range('글자 크기', () => d.fontScale, (v) => { d.fontScale = Math.round(v * 10) / 10; }, { min: 0.8, max: 1.4, step: 0.1, fmt: (v) => `${Math.round(v * 100)}%`, path: 'design.fontScale' }),
    radios('시간표 위치', 'ttSide', [['left', '왼쪽'], ['right', '오른쪽']], () => d.layout.timetable, (v) => { d.layout.timetable = v; changed(); }),
    h('fieldset', { class: 'radios' }, h('legend', { text: '보일 칸' }),
      Object.keys(BLOCK_NAME).map((k) => check(BLOCK_NAME[k], () => d.layout.blocks[k], (v) => { d.layout.blocks[k] = v; }, changed, { key: `block:${k}` }))),
    order(d),
    radios('배경', 'bgKind', [['color', '단색'], ['image', '이미지']], () => d.background.kind, (v) => {
      if (v === 'image' && !b.images.length) return false;
      d.background.kind = v;
      if (v === 'image') d.background.imageId ??= b.images[0].id;
      changed();
      rerender(`bgKind:${v}`);
    }),
    d.background.kind === 'image' ? h('div', { class: 'grid2' },
      field('배경 이미지', bgImg, { path: 'design.background.imageId' }),
      range('덮개 진하기 (바탕색을 덮는 정도)', () => d.background.overlay, (v) => { d.background.overlay = v; }, { min: 0.5, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, path: 'design.background.overlay' }))
      : h('p', { class: 'hint', text: b.images.length ? '이미지 배경은 칸 사이와 가장자리에만 보입니다' : '이미지 배경을 쓰려면 이미지 탭에서 먼저 올리세요' }),
    field('안내 넘기는 시간 (초)', bindInput(h('input', { type: 'number', min: 5, max: 120, class: 'num' }), () => d.rotateSec, (v) => { d.rotateSec = Number(v); }, changed),
      { path: 'design.rotateSec', hint: '5~120초. 글이 길면 저절로 더 오래 보입니다' }),
    check('시계 보이기', () => d.showClock, (v) => { d.showClock = v; }, changed, { key: 'clock' }),
    h('div', { class: 'bar' }, button('기본값으로 되돌리기', () => { b.design = structuredClone(DEFAULT_DESIGN); changed(); rerender('design:reset'); }, { key: 'design:reset' })),
  );
}
