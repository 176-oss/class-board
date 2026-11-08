// 이미지 탭: 고르기 → canvas 다시 그리기 → 올리기, 대체 글, 쓰는 곳, 삭제 (계약 2-7, 10-2).
import { S, changed, rerender, hooks } from './state.js';
import { h, field, bindInput, button, say, confirmBox, uid } from './ui.js';
import { toJpeg, IMAGE_TYPES } from './image.js';
import { randomId } from '../core/ids.js';
import { LIMITS } from '../core/schema.js';

export const imageName = (im) => im.alt || `이미지 ${S.board.images.indexOf(im) + 1}`;

export function imageUsers(imageId) {
  const b = S.board;
  const out = b.notices.filter((n) => n.imageId === imageId).map((n) => `안내 '${n.title}'`);
  if (b.design.background.kind === 'image' && b.design.background.imageId === imageId) out.push('배경');
  return out;
}

// 게시판에서 이 이미지를 가리키는 곳을 모두 푼다.
export function unlinkImage(board, imageId) {
  board.images = board.images.filter((i) => i.id !== imageId);
  for (const n of board.notices) if (n.imageId === imageId) n.imageId = null;
  if (board.design.background.imageId === imageId) board.design.background = { ...board.design.background, kind: 'color', imageId: null };
}

function savedFileIds() {
  try { return new Set((JSON.parse(S.serverText).images ?? []).map((i) => i.fileId)); } catch { return new Set(); }
}

// 저장본에 없던 이미지는 저장 뒤 정리 대상이 아니므로 지금 영구 삭제한다.
export function dropImage(imageId) {
  const im = S.board.images.find((i) => i.id === imageId);
  if (!im) return;
  unlinkImage(S.board, imageId);
  if (!savedFileIds().has(im.fileId)) {
    S.drive.deleteFile(im.fileId).catch(() => {});
    URL.revokeObjectURL(S.imgUrls.get(im.fileId) ?? '');
    S.imgUrls.delete(im.fileId);
  }
}

async function upload(file) {
  const { blob, w, h: height } = await toJpeg(file);
  const { id: fileId } = await S.drive.uploadImage(S.fileId, blob);
  S.imgUrls.set(fileId, URL.createObjectURL(blob));
  const id = randomId(10);
  S.board.images.push({ id, fileId, alt: '', w, h: height });
  changed();
  rerender(`img:${id}:alt`);
  say('이미지를 올렸습니다. 대체 글을 적어 주세요');
}

export function render(panel) {
  const b = S.board;
  const full = b.images.length >= LIMITS.images;
  const input = h('input', { type: 'file', accept: IMAGE_TYPES.join(','), class: 'visually-hidden', tabIndex: -1, 'aria-hidden': 'true' });
  input.addEventListener('change', () => {
    const f = input.files[0];
    input.value = '';
    if (f) hooks.run(() => upload(f));
  });
  const warnId = uid('w');
  const pick = button('그림 고르기', () => input.click(), { kind: 'primary', ic: 'plus', key: 'img:pick', disabled: full || S.newer });
  pick.setAttribute('aria-describedby', warnId);
  panel.append(
    h('h2', { text: '이미지' }),
    h('p', { class: 'warn-box', id: warnId }, h('strong', { text: '학생 얼굴이 나온 사진은 올리지 마세요.' }),
      ' JPEG, PNG, WebP 그림을 다시 그려 위치 정보 없이 올립니다 (긴 변 1600px, 약 500KB 이하).'),
    h('div', { class: 'bar' }, pick, input, h('span', { class: 'hint', text: `${b.images.length} / ${LIMITS.images}개` })),
    b.images.length ? h('ul', { class: 'img-list' }, b.images.map((im, i) => item(im, i))) : h('p', { class: 'empty', text: '올린 이미지가 없습니다' }),
  );
}

function item(im, i) {
  const url = S.imgUrls.get(im.fileId);
  const alt = bindInput(h('input', { type: 'text', maxLength: 100, 'data-key': `img:${im.id}:alt` }), () => im.alt, (v) => { im.alt = v; }, changed);
  const users = imageUsers(im.id);
  return h('li', { class: 'card img-item' },
    url ? h('img', { src: url, alt: im.alt, class: 'thumb' }) : h('div', { class: 'thumb', text: '불러오는 중' }),
    h('div', { class: 'grow' },
      field('대체 글 (그림을 설명하는 글)', alt, { path: `images[${i}].alt`, hint: '그림을 볼 수 없을 때 대신 보입니다' }),
      h('p', { class: 'hint', text: `${im.w}x${im.h}px. 쓰는 곳: ${users.length ? users.join(', ') : '쓰지 않음'}` })),
    button('삭제', async () => {
      const text = users.length ? `이 이미지를 쓰는 곳(${users.join(', ')})에서도 빠집니다. 저장하면 드라이브에서 영구 삭제됩니다.` : '저장하면 드라이브에서 영구 삭제됩니다.';
      if (!(await confirmBox('이미지 삭제', text, '삭제', { danger: true }))) return;
      dropImage(im.id);
      changed();
      rerender('img:pick');
    }, { kind: 'danger-ghost', ic: 'trash', key: `img:${im.id}:del` }));
}
