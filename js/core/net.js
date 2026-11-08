// 표시 화면의 확인 간격과 경고 판단 (계약 3-8). 모두 ms.
import { seoulNow } from './time.js';
import { DISPLAY_TEXT } from './drive-common.js';

export function startDelay(hasCache, rand) {
  return rand * (hasCache ? 60000 : 5000);
}

export function backoffDelay(attempt, rand) {
  const base = [60, 120, 300, 600][Math.min(Math.max(attempt, 1), 4) - 1];
  return Math.min(600000, Math.round(base * 1000 * (0.8 + 0.4 * rand)));
}

export function connectRetryDelay(n) {
  return n <= 1 ? 30000 : n === 2 ? 60000 : 300000;
}

export function staleness(lastOkMs, nowMs) {
  if (lastOkMs == null) return { level: 'ok', text: '' };
  const diff = nowMs - lastOkMs;
  if (diff > 86400000) return { level: 'days', text: DISPLAY_TEXT.days };
  if (diff > 600000) return { level: 'stale', text: DISPLAY_TEXT.stalePrefix + seoulNow(lastOkMs).time };
  return { level: 'ok', text: '' };
}

export function clockSkew(updatedAt, nowMs) {
  const t = Date.parse(updatedAt);
  return Number.isFinite(t) && t - nowMs > 300000;
}

export function isDawnReload(nowMs, lastReloadDate) {
  const { date, time } = seoulNow(nowMs);
  return time >= '03:00' && time < '05:00' && lastReloadDate !== date;
}
