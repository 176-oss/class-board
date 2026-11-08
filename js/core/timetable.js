// 오늘 시간표 계산 (계약 3-3).
import { seoulNow } from './time.js';

export function todayTimetable(board, nowMs) {
  const { date: today, time: t, weekday: wd } = seoulNow(nowMs);

  const off = (board.noClass ?? []).find((n) => n.startDate <= today && today <= n.endDate);
  if (off) return { status: 'noClass', label: off.label, rows: [] };
  if (wd === 'sat' || wd === 'sun') return { status: 'weekend', label: '주말', rows: [] };

  const version = (board.timetable ?? [])
    .filter((v) => v.effectiveFrom <= today)
    .reduce((a, v) => (!a || v.effectiveFrom > a.effectiveFrom ? v : a), null);
  if (!version) return { status: 'none', label: '', rows: [] };

  const periods = version.periodsByDay?.[wd]?.length ? version.periodsByDay[wd] : version.periods;
  const ov = (version.overrides ?? []).find((o) => o.date === today);
  const items = new Map();
  if (!ov?.replaceAll) for (const it of version.week?.[wd] ?? []) items.set(it.period, it);
  for (const it of ov?.items ?? []) items.set(it.period, it);

  const rows = [];
  for (const p of periods) {
    if (p.kind === 'class') {
      const it = items.get(p.no);
      if (!it || it.subject === '') continue;
      rows.push({ kind: 'class', no: p.no, label: `${p.no}교시`, start: p.start, end: p.end, subject: it.subject, note: it.note ?? '' });
    } else {
      rows.push({ kind: 'break', no: null, label: p.label || '쉬는 시간', start: p.start, end: p.end, subject: '', note: '' });
    }
  }
  if (!rows.some((r) => r.kind === 'class')) return { status: 'none', label: '', rows: [] };

  for (const r of rows) r.state = r.start <= t && t < r.end ? 'now' : r.end <= t ? 'past' : 'future';
  if (!rows.some((r) => r.kind === 'class' && r.state === 'now')) {
    const next = rows.find((r) => r.kind === 'class' && r.start > t);
    if (next) next.state = 'next';
  }
  return { status: 'class', label: '', rows };
}
