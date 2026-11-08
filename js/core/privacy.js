// 저장 전 전화번호 모양 글 찾기 (계약 3-9). 앞뒤가 숫자면 날짜·번호 일부라 뺀다.

const PATTERNS = [
  /(?<!\d)01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g,
  /(?<!\d)0(2|[3-6][1-5])[-.\s]\d{3,4}[-.\s]\d{4}(?!\d)/g,
];

export function phoneWarning(text) {
  const found = new Set();
  for (const re of PATTERNS) for (const m of String(text ?? '').matchAll(re)) found.add(m[0]);
  return [...found];
}
