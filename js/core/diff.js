// [차이 보기]: 내 편집본과 서버 본문을 칸별로 비교한다 (계약 5-6). added = 내 것에만 있음.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function byKey(section, mine, server, key, name) {
  const m = new Map(mine.map((x) => [key(x), x]));
  const s = new Map(server.map((x) => [key(x), x]));
  const added = [...m.keys()].filter((k) => !s.has(k)).map((k) => name(m.get(k)));
  const removed = [...s.keys()].filter((k) => !m.has(k)).map((k) => name(s.get(k)));
  const changed = [...m.keys()].filter((k) => s.has(k) && !same(m.get(k), s.get(k))).map((k) => name(m.get(k)));
  return { section, added, removed, changed };
}

function whole(section, a, b) {
  return { section, added: [], removed: [], changed: same(a, b) ? [] : [section] };
}

export function diffBoards(mine, server) {
  const { zones: mz, ...mDuty } = mine.duty;
  const { zones: sz, ...sDuty } = server.duty;
  return [
    whole('학급 이름', mine.title, server.title),
    byKey('안내', mine.notices, server.notices, (n) => n.id, (n) => n.title),
    whole('시간표', mine.timetable, server.timetable),
    byKey('방학·휴업일', mine.noClass, server.noClass, (n) => `${n.startDate}~${n.endDate}`, (n) => n.label),
    byKey('일정', mine.events, server.events, (e) => e.id, (e) => e.title),
    byKey('청소 구역', mz, sz, (z) => z.id, (z) => z.name),
    whole('청소당번', mDuty, sDuty),
    byKey('이미지', mine.images, server.images, (i) => i.id, (i) => i.alt || '대체 글 없는 이미지'),
    whole('디자인', mine.design, server.design),
  ].filter((d) => d.added.length || d.removed.length || d.changed.length);
}
