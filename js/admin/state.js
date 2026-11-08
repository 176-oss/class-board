// 입력 화면이 함께 보는 상태. 학생 이름(names)은 메모리에만 둔다 (계약 7절).
import { seoulNow } from '../core/time.js';

export const S = {
  drive: null,
  fake: false,
  fileId: null,
  board: null,          // 편집본 (학생 이름은 빠져 있음)
  names: new Map(),     // 번호 → 이름, 이 화면에서만
  serverText: '',       // 마지막으로 불러오거나 저장한 본문
  serverRev: 0,
  baseVersion: null,
  newer: false,
  shared: null,         // 'shared' | 'stopped' | null
  dirty: false,
  editSeq: 0,
  imgUrls: new Map(),   // 이미지 파일 ID → objectURL (미리보기·목록용)
};

// main.js 가 채운다: 탭 모듈이 main 을 import 하지 않게 (순환 방지).
export const hooks = {
  changed: () => {},
  rerender: () => {},
  run: async (fn) => fn(),
};

export const today = () => seoulNow(Date.now()).date;
export const changed = () => hooks.changed();
export const rerender = (focusKey) => hooks.rerender(focusKey);
