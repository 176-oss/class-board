// 개발용 견본을 가짜 드라이브 저장소에 넣는다 (?dev=1&seed=sample|worst). 입력 화면이 만든 것과 같은 모양으로 쓴다.
import { FAKE_INDEX, FAKE_TEXT, FAKE_IMG_CACHE, fakeImgKey, readIndex } from './fake-source.js';

export const SEED_IDS = { sample: 'fakeseedsample00000000000000', worst: 'fakeseedworst000000000000000' };
const SHARE = { id: 'anyoneWithLink', type: 'anyone', role: 'reader', allowFileDiscovery: false };

function put(index, id, meta) {
  const prev = index.files[id];
  index.files[id] = { parents: [], ...meta, version: (Number(prev?.version) || 0) + 1, modifiedTime: new Date().toISOString(), perms: [SHARE] };
}

// 견본 그림: 외부 파일 없이 canvas 로 만든 JPEG.
function drawJpeg(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#FBEFD5';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#C98A1B';
  g.fillRect(0, h * 0.7, w, h * 0.3);
  g.fillStyle = '#6B4410';
  g.beginPath();
  g.arc(w * 0.75, h * 0.3, h * 0.15, 0, Math.PI * 2);
  g.fill();
  g.fillRect(w * 0.1, h * 0.35, w * 0.3, h * 0.35);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.85));
}

export async function seedFake(kind) {
  const id = SEED_IDS[kind];
  if (!id) return null;
  const res = await fetch(`./tests/fixtures/board-${kind}.json`, { cache: 'no-store' });
  if (!res.ok) return null;
  const text = await res.text();
  const board = JSON.parse(text);
  const index = readIndex();
  for (const img of board.images ?? []) {
    const cache = await caches.open(FAKE_IMG_CACHE);
    if (!(await cache.match(fakeImgKey(img.fileId)))) await cache.put(fakeImgKey(img.fileId), new Response(await drawJpeg(img.w, img.h)));
    put(index, img.fileId, { name: `img-seed-${img.id}.jpg`, mimeType: 'image/jpeg', appProperties: { classboard: 'image', board: id } });
  }
  put(index, id, { name: `board-seed-${kind}.json`, mimeType: 'application/json', appProperties: { classboard: 'board' } });
  localStorage.setItem(FAKE_TEXT + id, text);
  localStorage.setItem(FAKE_INDEX, JSON.stringify(index));
  return id;
}
