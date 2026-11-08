// 날짜와 시각 계산. 모두 서울 기준이고 PC 시간대를 보지 않는다 (계약 3-2).

const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
});

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_MS = 86400000;

function parts(dateMs) {
  const o = {};
  for (const p of FMT.formatToParts(dateMs)) o[p.type] = p.value;
  return o;
}

export function seoulNow(dateMs) {
  const p = parts(dateMs);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    weekday: p.weekday.slice(0, 3).toLowerCase(),
    seconds: Number(p.second),
  };
}

export function seoulIso(dateMs) {
  const p = parts(dateMs);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+09:00`;
}

// UTC 정오로 바꾸면 어느 시간대에서도 날짜가 밀리지 않는다.
function toUtcNoon(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

function fromUtc(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function isDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(toUtcNoon(s)) === s;
}

export function isTime(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function addDays(date, n) {
  return fromUtc(toUtcNoon(date) + n * DAY_MS);
}

export function daysBetween(a, b) {
  return Math.round((toUtcNoon(b) - toUtcNoon(a)) / DAY_MS);
}

export function weekdayOf(date) {
  return WEEKDAYS[new Date(toUtcNoon(date)).getUTCDay()];
}

export function mondayOf(date) {
  return addDays(date, -((new Date(toUtcNoon(date)).getUTCDay() + 6) % 7));
}
