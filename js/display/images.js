// 이미지 Cache Storage 보관과 정리 (계약 7절, 9절 이미지). 캐시 요청 키에는 API 키를 넣지 않는다.
import { activeNotices } from '../core/notices.js';

const cacheName = (boardId) => 'classboard:img:' + boardId;
const imgKey = (fileId) => './__img/' + fileId;
const urls = new Map(); // fileId → objectURL

// 오늘 보여 줄 안내와 배경이 가리키는 이미지 파일 ID.
export function neededFileIds(board, date) {
  const ids = new Set(activeNotices(board, date).map((n) => n.imageId).filter(Boolean));
  if (board.design.background.kind === 'image' && board.design.background.imageId) ids.add(board.design.background.imageId);
  return board.images.filter((i) => ids.has(i.id)).map((i) => i.fileId);
}

// 없는 이미지만 받고, images 에 없는 캐시 항목은 지운다. 한 장 실패는 그 자리 대체 글로 넘어간다.
export async function syncImages(source, boardId, board, date) {
  if (!('caches' in self)) return;
  const cache = await caches.open(cacheName(boardId));
  for (const fileId of neededFileIds(board, date)) {
    if (await cache.match(imgKey(fileId))) continue;
    try {
      const blob = await source.getImage(fileId);
      await cache.put(imgKey(fileId), new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } }));
    } catch { /* 다음 확인 때 다시 시도 */ }
  }
  const keep = new Set(board.images.map((i) => new URL(imgKey(i.fileId), location.href).href));
  for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
  await loadUrls(boardId, board);
}

// 캐시에 있는 것만 objectURL 로 만든다 (오프라인 시작에도 쓰임).
export async function loadUrls(boardId, board) {
  if (!('caches' in self)) return;
  const cache = await caches.open(cacheName(boardId));
  const want = new Set(board.images.map((i) => i.fileId));
  for (const [fileId, url] of urls) {
    if (!want.has(fileId)) { URL.revokeObjectURL(url); urls.delete(fileId); }
  }
  for (const fileId of want) {
    if (urls.has(fileId)) continue;
    const res = await cache.match(imgKey(fileId));
    if (res) urls.set(fileId, URL.createObjectURL(await res.blob()));
  }
}

export const imageUrl = (fileId) => urls.get(fileId) ?? null;

export async function clearImages(boardId) {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
  if ('caches' in self) await caches.delete(cacheName(boardId));
}
