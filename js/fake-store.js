// 가짜 드라이브의 브라우저 저장소 (계약 6절). 표시 화면 fake-source.js 가 같은 키를 읽는다.
import { FAKE_IMG_CACHE, fakeImgKey } from './display/fake-source.js';

// 같은 출처의 다른 앱 키를 건드리지 않게 접두사를 강제한다.
const key = (k) => {
  if (!String(k).startsWith('classboard:fake:')) throw new TypeError('classboard:fake: 키만 씁니다');
  return k;
};
const cache = () => caches.open(FAKE_IMG_CACHE);

export const browserStore = {
  async getText(k) { return localStorage.getItem(key(k)); },
  async setText(k, v) { localStorage.setItem(key(k), v); },
  async removeText(k) { localStorage.removeItem(key(k)); },
  async getBlob(id) {
    const res = await (await cache()).match(fakeImgKey(id));
    return res ? res.blob() : null;
  },
  async setBlob(id, blob) { await (await cache()).put(fakeImgKey(id), new Response(blob, { headers: { 'Content-Type': 'image/jpeg' } })); },
  async removeBlob(id) { await (await cache()).delete(fakeImgKey(id)); },
};
