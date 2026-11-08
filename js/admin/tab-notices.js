// 안내 탭: 제목·내용·기간·중요·이미지, 위로/아래로, 복제, 지난 안내 (계약 2-6, 10-2).
import { S, changed, rerender, today } from './state.js';
import { h, field, bindInput, check, button, confirmBox } from './ui.js';
import { imageName, imageUsers, dropImage } from './tab-images.js';
import { randomId } from '../core/ids.js';
import { oldNotices } from '../core/edit.js';

const isPast = (n, t) => n.endDate && n.endDate < t;

function add() {
  const n = { id: randomId(10), title: '새 안내', body: '', important: false, startDate: today(), endDate: null, order: 0, imageId: null, imageAlt: '' };
  S.board.notices.unshift(n);
  changed();
  rerender(`notice:${n.id}:title`);
}

// 같은 무리(지금/지난) 안에서 이웃과 자리를 바꾼다.
function move(n, delta) {
  const arr = S.board.notices;
  const group = arr.filter((x) => !!isPast(x, today()) === !!isPast(n, today()));
  const other = group[group.indexOf(n) + delta];
  if (!other) return;
  const i = arr.indexOf(n);
  const j = arr.indexOf(other);
  [arr[i], arr[j]] = [arr[j], arr[i]];
  changed();
  rerender();
}

async function remove(n) {
  const onlyHere = n.imageId && imageUsers(n.imageId).length === 1;
  if (onlyHere && !(await confirmBox('안내 삭제', '이 안내에 붙인 이미지도 저장할 때 영구 삭제됩니다. 지울까요?', '삭제', { danger: true }))) return;
  S.board.notices = S.board.notices.filter((x) => x !== n);
  if (onlyHere) dropImage(n.imageId);
  changed();
  rerender('notice:add');
}

async function removeOld() {
  const old = oldNotices(S.board.notices, today());
  if (!(await confirmBox('지난 안내 지우기', `끝난 지 90일이 지난 안내 ${old.length}개를 지웁니다.`, '지우기', { danger: true }))) return;
  for (const n of old) {
    const onlyHere = n.imageId && imageUsers(n.imageId).length === 1;
    S.board.notices = S.board.notices.filter((x) => x !== n);
    if (onlyHere) dropImage(n.imageId);
  }
  changed();
  rerender('notice:add');
}

function card(n) {
  const b = S.board;
  const p = `notices[${b.notices.indexOf(n)}]`;
  const k = `notice:${n.id}`;
  const img = h('select', { 'data-key': `${k}:img` },
    h('option', { value: '', text: '붙이지 않음' }),
    b.images.map((im) => h('option', { value: im.id, text: imageName(im), selected: n.imageId === im.id })));
  img.addEventListener('change', () => { n.imageId = img.value || null; changed(); });
  return h('article', { class: 'card' },
    h('div', { class: 'grid2' },
      field('제목', bindInput(h('input', { type: 'text', maxLength: 40, 'data-key': `${k}:title` }), () => n.title, (v) => { n.title = v; }, changed), { path: `${p}.title`, wide: true }),
      field('내용', bindInput(h('textarea', { rows: 4, maxLength: 500 }), () => n.body, (v) => { n.body = v; }, changed),
        { path: `${p}.body`, wide: true, hint: '500자까지. 굵게 쓰려면 **글** 처럼 별표 두 개로 감쌉니다' }),
      field('시작일', bindInput(h('input', { type: 'date' }), () => n.startDate, (v) => { n.startDate = v; }, changed), { path: `${p}.startDate` }),
      field('종료일', bindInput(h('input', { type: 'date' }), () => n.endDate, (v) => { n.endDate = v || null; }, changed), { path: `${p}.endDate`, hint: '비우면 계속 보입니다' }),
      field('이미지 붙이기', img, { path: `${p}.imageId`, hint: b.images.length ? '' : '이미지 탭에서 먼저 올리세요' }),
      field('이미지 대체 글', bindInput(h('input', { type: 'text', maxLength: 100 }), () => n.imageAlt, (v) => { n.imageAlt = v; }, changed),
        { path: `${p}.imageAlt`, hint: '비우면 이미지 탭의 대체 글을 씁니다' })),
    h('div', { class: 'row-actions' },
      check('중요 (맨 위에 고정)', () => n.important, (v) => { n.important = v; }, changed, { key: `${k}:imp` }),
      button('위로', () => move(n, -1), { ic: 'up', key: `${k}:up` }),
      button('아래로', () => move(n, 1), { ic: 'down', key: `${k}:down` }),
      button('복제', () => {
        const c = { ...structuredClone(n), id: randomId(10) };
        b.notices.splice(b.notices.indexOf(n) + 1, 0, c);
        changed();
        rerender(`notice:${c.id}:title`);
      }, { ic: 'copy', key: `${k}:copy` }),
      button('삭제', () => remove(n), { kind: 'danger-ghost', ic: 'trash', key: `${k}:del` })));
}

export function render(panel) {
  const t = today();
  const list = S.board.notices;
  const current = list.filter((n) => !isPast(n, t));
  const past = list.filter((n) => isPast(n, t));
  const old = oldNotices(list, t);
  panel.append(
    h('h2', { text: '안내' }),
    h('div', { class: 'bar' }, button('새 안내 추가', add, { kind: 'primary', ic: 'plus', key: 'notice:add', disabled: S.newer }),
      h('span', { class: 'hint', text: '학급 PC에는 중요 안내가 먼저, 그다음 이 목록 순서로 보입니다' })),
    old.length ? h('div', { class: 'warn-box' }, h('p', { text: `끝난 지 90일이 지난 안내가 ${old.length}개 있습니다. 지울까요?` }),
      button('지난 안내 지우기', removeOld, { key: 'notice:old' })) : null,
    current.length ? current.map(card) : h('p', { class: 'empty', text: '게시 중이거나 예정된 안내가 없습니다' }),
    past.length ? h('details', { class: 'past', open: !!S.pastOpen, ontoggle: (e) => { S.pastOpen = e.target.open; } }, h('summary', { text: `지난 안내 ${past.length}개` }), past.map(card)) : null,
  );
}
