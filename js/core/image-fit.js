// 긴 변이 max 이하가 되게 비율을 지켜 줄인다 (계약 1절). 키우지 않는다.
export function fitSize(w, h, max = 1600) {
  const long = Math.max(w, h);
  if (long <= max) return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
  const k = max / long;
  return { w: Math.min(max, Math.max(1, Math.round(w * k))), h: Math.min(max, Math.max(1, Math.round(h * k))) };
}
