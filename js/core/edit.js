// 입력 화면의 순수 계산: 저장 준비, 당번 이름, 이미지 정리, 공유 판단 (계약 2-7, 2-8, 5-2, 5-6).
import { seoulIso, seoulNow, daysBetween } from './time.js';
import { maskName } from './duty.js';

export const SHARE_BODY = { type: 'anyone', role: 'reader', allowFileDiscovery: false };
const DAY_MS = 86400000;

// 공유 확인: 바른 항목 하나와, 지우고 다시 만들어야 하는 anyone 항목들.
export function findShare(perms) {
  const anyone = (perms ?? []).filter((p) => p?.type === 'anyone');
  const ok = anyone.find((p) => p.role === 'reader' && p.allowFileDiscovery === false) ?? null;
  return { ok, bad: anyone.filter((p) => p !== ok) };
}

// number 모드에서는 이름을 절대 넣지 않는다. names: Map(no → 화면에 입력한 이름).
export function withNames(duty, names, nameMode = duty.nameMode) {
  const students = duty.students.map(({ no }) => {
    const raw = String(names?.get(no) ?? '').trim();
    if (nameMode === 'number' || !raw) return { no };
    return { no, name: nameMode === 'masked' ? maskName(raw) : raw };
  });
  return { ...duty, nameMode, students };
}

// 저장(또는 미리보기)할 모양: rev, updatedAt, 이름, 지난 교체 지우기, 안내 순서.
export function composeBoard(draft, { names, serverRev, nowMs }) {
  const b = structuredClone(draft);
  const today = seoulNow(nowMs).date;
  b.rev = serverRev + 1;
  b.updatedAt = seoulIso(nowMs);
  b.duty = withNames(b.duty, names);
  b.duty.swaps = b.duty.swaps.filter((s) => !(s.date < today));
  b.notices = b.notices.map((n, i) => ({ ...n, order: i }));
  return b;
}

export function moveItem(arr, i, delta) {
  const j = i + delta;
  if (i < 0 || i >= arr.length || j < 0 || j >= arr.length) return arr.slice();
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// 직전 저장본에 있었는데 새 저장본에 없는 이미지 파일.
export function removedFileIds(prevImages, nextImages) {
  const keep = new Set((nextImages ?? []).map((i) => i.fileId));
  return [...new Set((prevImages ?? []).map((i) => i.fileId))].filter((f) => !keep.has(f));
}

// 저장하지 않고 닫아 남은 이미지: 게시판이 모르고 24시간 넘은 것.
export function orphanImageIds(listed, images, nowMs) {
  const known = new Set((images ?? []).map((i) => i.fileId));
  return (listed ?? []).filter((f) => !known.has(f.id) && nowMs - Date.parse(f.modifiedTime) > DAY_MS).map((f) => f.id);
}

// 이력은 rev 내림차순으로 5개만 남긴다.
export function historyToDelete(list, keep = 5) {
  return [...list].sort((a, b) => b.rev - a.rev).slice(keep);
}

export function oldNotices(notices, today) {
  return notices.filter((n) => n.endDate && daysBetween(n.endDate, today) > 90);
}

// 전화번호 검사 대상: 사람이 쓴 글만 (파일 ID·날짜는 빼야 오탐이 없다).
export function userTexts(board) {
  const out = [board.title];
  for (const n of board.notices) out.push(n.title, n.body, n.imageAlt);
  for (const e of board.events) out.push(e.title, e.note);
  for (const n of board.noClass) out.push(n.label);
  for (const i of board.images) out.push(i.alt);
  for (const z of board.duty.zones) out.push(z.name);
  out.push(board.duty.note);
  for (const v of board.timetable) {
    for (const items of Object.values(v.week)) for (const it of items) out.push(it.subject, it.note);
    for (const o of v.overrides) for (const it of o.items) out.push(it.subject, it.note);
    for (const r of v.periods) out.push(r.label);
  }
  return out.filter((s) => typeof s === 'string' && s !== '');
}

const TAB_OF = { notices: 'notices', timetable: 'timetable', noClass: 'timetable', events: 'events', duty: 'duty', images: 'images', design: 'design', title: 'design' };

// 오류 경로가 어느 탭 칸인지 ('notices[3].title' → 'notices').
export function tabOfPath(path) {
  return TAB_OF[/^[A-Za-z]+/.exec(path ?? '')?.[0]] ?? null;
}

// 고정 당번 칸의 '3, 7, 12' 같은 글을 번호 목록으로.
export function parseNumbers(text) {
  return [...String(text ?? '').matchAll(/\d+/g)].map((m) => Number(m[0]));
}
