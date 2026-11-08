// 파일 ID 검사와 이름 만들기 (계약 3-9).

export function isValidFileId(s) {
  return typeof s === 'string' && /^[A-Za-z0-9_-]{20,80}$/.test(s);
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomId(n = 12) {
  let out = '';
  while (out.length < n) {
    for (const b of crypto.getRandomValues(new Uint8Array(n * 2))) {
      // 252 = 36 x 7. 그 이상을 버려야 글자마다 확률이 같다.
      if (b < 252 && out.length < n) out += ALPHABET[b % 36];
    }
  }
  return out;
}

export function boardFileName() {
  return 'board-' + randomId(12) + '.json';
}

export function imageFileName() {
  return 'img-' + randomId(12) + '.jpg';
}

export function historyFileName(boardId, rev) {
  return 'classboard-hist-' + boardId + '-' + rev + '.json';
}

export function parseHistoryName(name) {
  const m = typeof name === 'string' && /^classboard-hist-([A-Za-z0-9_-]+)-([1-9]\d*)\.json$/.exec(name);
  if (!m || !isValidFileId(m[1])) return null;
  return { boardId: m[1], rev: Number(m[2]) };
}
