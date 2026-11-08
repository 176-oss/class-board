// 오늘 안내 고르기, 페이지 나누기, 굵게 표시 (계약 3-4).

export function activeNotices(board, date) {
  return (board.notices ?? [])
    .filter((n) => n.startDate <= date && (n.endDate === null || date <= n.endDate))
    .sort((a, b) =>
      (b.important - a.important) || (a.order - b.order) ||
      cmp(a.startDate, b.startDate) || cmp(a.id, b.id));
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function noticeChars(n) {
  return [...n.title].length + [...(n.body ?? '')].length;
}

// 16절 10번 스크린샷에서 잘리면 600만 조정한다.
const BASE_PAGE_CHARS = 600;
const PAGE_ITEMS = 3;

export function pageNotices(list, { rotateSec, fontScale = 1 }) {
  const pageChars = Math.floor(BASE_PAGE_CHARS / fontScale);
  const pinned = list.filter((n) => n.important).slice(0, 2);
  const groups = [];
  let cur = null;
  for (const n of list) {
    const c = noticeChars(n);
    if (n.imageId || c > pageChars) {
      groups.push({ items: [n], chars: c });
      cur = null;
    } else if (cur && cur.chars + c <= pageChars && cur.items.length < PAGE_ITEMS) {
      cur.items.push(n);
      cur.chars += c;
    } else {
      cur = { items: [n], chars: c };
      groups.push(cur);
    }
  }
  const pages = groups.map((g) => ({ items: g.items, sec: Math.max(rotateSec, Math.ceil(g.chars / 8)) }));
  return { pinned, pages };
}

export function richLines(body) {
  return String(body ?? '').split('\n').map((line) => {
    const parts = line.split('**');
    // 표시가 홀수 개면 마지막 '**'는 짝이 없으므로 글자로 되돌린다.
    if (parts.length % 2 === 0) parts.splice(-2, 2, parts.at(-2) + '**' + parts.at(-1));
    return parts.map((text, i) => ({ text, bold: i % 2 === 1 })).filter((s) => s.text !== '');
  });
}
