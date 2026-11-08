// 표시 화면 색 묶음의 유일한 원본과 대비 검사 (계약 4절).

export const PALETTES = {
  honey: { bg: '#FBEFD5', surface: '#FFFFFF', text: '#2E2418', muted: '#6E604E', accent: '#8A5A0B', fill: '#C98A1B', onFill: '#2E2418', title: '#6B4410', warn: '#B42318', line: '#E8DCC6' },
  brown: { bg: '#6B4410', surface: '#56360C', text: '#FFFFFF', muted: '#FBEFD5', accent: '#F7C97A', fill: '#C98A1B', onFill: '#2E2418', title: '#FFFFFF', warn: '#FFB4A8', line: '#8A5A0B' },
  sand: { bg: '#F6EEDF', surface: '#FDF8EE', text: '#2E2418', muted: '#6E604E', accent: '#7A4F0A', fill: '#C98A1B', onFill: '#2E2418', title: '#6B4410', warn: '#B42318', line: '#E8DCC6' },
  night: { bg: '#1B150E', surface: '#2E2418', text: '#FBEFD5', muted: '#CDBFA8', accent: '#E9B04A', fill: '#C98A1B', onFill: '#1B150E', title: '#FBEFD5', warn: '#FF9A8C', line: '#4A3D2C' },
};

function luminance(hex) {
  if (typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new TypeError('색은 #RRGGBB 형식이어야 합니다');
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA, hexB) {
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function checkPalette(p) {
  const pairs = [];
  for (const fg of ['text', 'muted', 'accent', 'title', 'warn']) {
    for (const bg of ['bg', 'surface']) pairs.push({ fg, bg, ratio: contrastRatio(p[fg], p[bg]) });
  }
  pairs.push({ fg: 'onFill', bg: 'fill', ratio: contrastRatio(p.onFill, p.fill) });
  return { ok: pairs.every((x) => x.ratio >= 4.5), pairs };
}
