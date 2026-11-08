// 다가오는 일정과 D-day (계약 3-5).
import { daysBetween } from './time.js';

export function eventsView(board, date, limit = 5) {
  const list = (board.events ?? [])
    .filter((e) => (e.endDate ?? e.date) >= date)
    .sort((a, b) => cmp(a.date, b.date) || cmp(a.time, b.time) || cmp(a.id, b.id))
    .map((e) => {
      const ongoing = e.date <= date;
      return {
        id: e.id, title: e.title, date: e.date, endDate: e.endDate ?? null, time: e.time ?? '', note: e.note ?? '',
        dday: ongoing ? 'D-Day' : 'D-' + daysBetween(date, e.date),
        state: ongoing ? 'ongoing' : 'upcoming',
      };
    });
  return { items: list.slice(0, limit), more: Math.max(0, list.length - limit) };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
