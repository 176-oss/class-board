// 오늘 청소당번 계산 (계약 3-6).
import { daysBetween, mondayOf, weekdayOf, addDays } from './time.js';

export function maskName(fullName) {
  const chars = [...String(fullName ?? '').trim()];
  if (!chars.length) return '';
  return chars[0] + '○'.repeat(Math.max(1, chars.length - 1));
}

function weekdaysFrom(start, end) {
  let k = 0;
  for (let d = start; d < end; d = addDays(d, 1)) if (!['sat', 'sun'].includes(weekdayOf(d))) k++;
  return k;
}

export function dutyFor(duty, date, swaps = duty.swaps) {
  const zones = duty.zones ?? [];
  const students = [...(duty.students ?? [])].sort((a, b) => a.no - b.no);
  if (!zones.length || !students.length) return { status: 'none', startDate: null, zones: [] };
  const wd = weekdayOf(date);
  if (wd === 'sat' || wd === 'sun') return { status: 'weekend', startDate: null, zones: [] };

  let lists;
  if (duty.mode === 'fixed') {
    lists = zones.map((z) => [...(duty.fixed?.[wd]?.[z.id] ?? [])]);
  } else {
    const { startDate, unit, perZone } = duty.rotate;
    if (date < startDate) return { status: 'before', startDate, zones: [] };
    const k = unit === 'day' ? weekdaysFrom(startDate, date) : daysBetween(mondayOf(startDate), mondayOf(date)) / 7;
    const n = students.length;
    const offset = (k * zones.length * perZone) % n;
    lists = zones.map((_, j) => Array.from({ length: perZone }, (_, i) => students[(offset + j * perZone + i) % n].no));
  }

  for (const s of swaps ?? []) {
    if (s.date !== date) continue;
    const list = lists[zones.findIndex((z) => z.id === s.zoneId)];
    const at = list ? list.indexOf(s.from) : -1;
    if (at < 0) continue;
    if (s.to === null) list.splice(at, 1);
    else list[at] = s.to;
  }

  const byNo = new Map(students.map((s) => [s.no, s]));
  const label = (no) => {
    const name = byNo.get(no)?.name;
    return duty.nameMode !== 'number' && name ? `${no}번 ${name}` : `${no}번`;
  };
  return {
    status: 'ok', startDate: null,
    zones: zones.map((z, j) => ({ id: z.id, name: z.name, students: lists[j].map((no) => ({ no, label: label(no) })) })),
  };
}
