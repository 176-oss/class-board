// 게시판 파일 검사와 정규화 (계약 2절, 3-1). 알려진 필드만 새로 만들어 돌려준다.
import { seoulIso, seoulNow, isDate, isTime, daysBetween, weekdayOf } from './time.js';
import { isValidFileId } from './ids.js';
import { PALETTES } from './palette.js';

export const SUPPORTED_SCHEMA = 1;
export const LIMITS = { activeNotices: 50, notices: 200, noticeTitle: 40, noticeBody: 500, events: 200, classPeriodsPerDay: 12,
  periodRows: 20, zones: 12, students: 60, images: 20, bytes: 204800, warnBytes: 153600, noClass: 100, overrides: 400, swaps: 50, timetableVersions: 10 };
export const DEFAULT_DESIGN = { template: 'basic', palette: 'honey', fontScale: 1.0,
  layout: { timetable: 'left', blocks: { timetable: true, notices: true, events: true, duty: true }, order: ['notices', 'events', 'duty'] },
  background: { kind: 'color', imageId: null, overlay: 0.85 }, rotateSec: 15, showClock: true };

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const DEFAULT_PERIODS = [
  ['class', 1, '09:00', '09:45'], ['class', 2, '09:55', '10:40'], ['class', 3, '10:50', '11:35'], ['class', 4, '11:45', '12:30'],
  ['break', null, '12:30', '13:20', '점심'], ['class', 5, '13:20', '14:05'], ['class', 6, '14:15', '15:00'], ['class', 7, '15:10', '15:55'],
].map(([kind, no, start, end, label = '']) => ({ no, start, end, kind, label }));

export function defaultBoard(title, nowMs) {
  const today = seoulNow(nowMs).date;
  return {
    kind: 'class-board', schemaVersion: SUPPORTED_SCHEMA, minReader: 1, rev: 1, updatedAt: seoulIso(nowMs), title,
    design: structuredClone(DEFAULT_DESIGN),
    timetable: [{ effectiveFrom: today, periods: structuredClone(DEFAULT_PERIODS), week: { mon: [], tue: [], wed: [], thu: [], fri: [] }, periodsByDay: {}, overrides: [] }],
    noClass: [], events: [], notices: [], images: [],
    duty: { zones: [], students: [], nameMode: 'number', mode: 'rotate', rotate: { startDate: today, unit: 'week', perZone: 1 }, fixed: null, swaps: [], note: '' },
  };
}

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const UPDATED_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const CONTROL_RE = /[\u0000-\u001F\u007F]/;
const CONTROL_NO_LF_RE = /[\u0000-\u0009\u000B-\u001F\u007F]/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const len = (s) => [...s].length;

// 오류를 모으는 검사 도구. 각 함수는 통과한 값 또는 undefined 를 돌려준다.
function checker() {
  const errors = [];
  const err = (path, code) => { errors.push({ path, code }); };
  const has = (o, k) => o[k] !== undefined;

  function str(o, k, path, { min = 0, max, def, allowLf = false } = {}) {
    if (!has(o, k)) { if (def !== undefined) return def; err(path, 'required'); return undefined; }
    const v = o[k];
    if (typeof v !== 'string') return err(path, 'type');
    if ((allowLf ? CONTROL_NO_LF_RE : CONTROL_RE).test(v)) return err(path, 'format');
    if (min > 0 && v === '') return err(path, 'required');
    if (len(v) > max) return err(path, 'limit');
    return v;
  }
  function int(o, k, path, { min, max, def } = {}) {
    if (!has(o, k)) { if (def !== undefined) return def; err(path, 'required'); return undefined; }
    const v = o[k];
    if (!Number.isInteger(v)) return err(path, 'type');
    if (v < min || v > max) return err(path, 'range');
    return v;
  }
  function bool(o, k, path, def) {
    if (!has(o, k)) return def;
    if (typeof o[k] !== 'boolean') return err(path, 'type');
    return o[k];
  }
  function date(o, k, path, { nullable = false } = {}) {
    if (!has(o, k) || (nullable && o[k] === null)) { if (nullable) return null; err(path, 'required'); return undefined; }
    if (typeof o[k] !== 'string') return err(path, 'type');
    if (!isDate(o[k])) return err(path, 'format');
    return o[k];
  }
  function list(o, k, path, max, { required = false, min = 0 } = {}) {
    if (!has(o, k)) { if (required) err(path, 'required'); return required ? undefined : []; }
    const v = o[k];
    if (!Array.isArray(v)) return err(path, 'type');
    if (v.length > max) return err(path, 'limit');
    if (v.length < min) return err(path, 'range');
    return v;
  }
  function obj(v, path) {
    if (!isObj(v)) return err(path, 'type');
    return v;
  }
  function ids(items, path) {
    const seen = new Set();
    items.forEach((it, i) => {
      const id = it?.id;
      if (id === undefined) return err(`${path}[${i}].id`, 'required');
      if (typeof id !== 'string' || !ID_RE.test(id)) return err(`${path}[${i}].id`, 'format');
      if (seen.has(id)) err(`${path}[${i}].id`, 'duplicate');
      seen.add(id);
    });
  }
  return { errors, err, str, int, bool, date, list, obj, ids };
}

export function validateBoard(input) {
  let data = input;
  const warnings = [];
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  const bytes = new TextEncoder().encode(text ?? '').length;
  if (bytes > LIMITS.bytes) return fail([{ path: '', code: 'tooBig' }]);
  if (bytes > LIMITS.warnBytes) warnings.push({ path: '', code: 'size150' });
  if (typeof input === 'string') {
    try { data = JSON.parse(input); } catch { return fail([{ path: '', code: 'json' }]); }
  }
  if (!isObj(data)) return fail([{ path: '', code: 'type' }]);
  if (data.kind !== 'class-board') return fail([{ path: 'kind', code: 'kind' }]);

  const c = checker();
  const minReader = c.int(data, 'minReader', 'minReader', { min: 1, max: Number.MAX_SAFE_INTEGER, def: 1 });
  if (minReader > SUPPORTED_SCHEMA) return { ok: false, needsUpdate: true, errors: [{ path: 'minReader', code: 'schemaMajor' }] };
  const schemaVersion = c.int(data, 'schemaVersion', 'schemaVersion', { min: 1, max: Number.MAX_SAFE_INTEGER });
  const rev = c.int(data, 'rev', 'rev', { min: 1, max: Number.MAX_SAFE_INTEGER });
  let updatedAt = c.str(data, 'updatedAt', 'updatedAt', { max: 40 });
  if (updatedAt !== undefined && (!UPDATED_RE.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt)))) updatedAt = c.err('updatedAt', 'format');
  const title = c.str(data, 'title', 'title', { min: 1, max: 40 });
  const today = updatedAt ? seoulNow(Date.parse(updatedAt)).date : null;

  const images = checkImages(c, data);
  const imageIds = new Set(images.map((im) => im.id));
  const board = {
    kind: 'class-board', schemaVersion, minReader, rev, updatedAt, title,
    design: checkDesign(data.design, imageIds, warnings),
    timetable: checkTimetable(c, data),
    noClass: checkNoClass(c, data),
    events: checkEvents(c, data),
    notices: checkNotices(c, data, imageIds, today, warnings),
    images,
    duty: checkDuty(c, data),
  };
  if (c.errors.length) return fail(c.errors);
  return { ok: true, board, warnings, newer: schemaVersion > SUPPORTED_SCHEMA };
}

function fail(errors) {
  return { ok: false, needsUpdate: false, errors };
}

function checkImages(c, data) {
  const arr = c.list(data, 'images', 'images', LIMITS.images) ?? [];
  c.ids(arr, 'images');
  return arr.map((im, i) => {
    const p = `images[${i}]`;
    if (!c.obj(im, p)) return null;
    const fileId = im.fileId;
    if (!isValidFileId(fileId)) c.err(`${p}.fileId`, fileId === undefined ? 'required' : 'format');
    return {
      id: im.id, fileId,
      alt: c.str(im, 'alt', `${p}.alt`, { max: 100, def: '' }),
      w: c.int(im, 'w', `${p}.w`, { min: 1, max: 1600 }),
      h: c.int(im, 'h', `${p}.h`, { min: 1, max: 1600 }),
    };
  }).filter(Boolean);
}

function checkDesign(input, imageIds, warnings) {
  const d = structuredClone(DEFAULT_DESIGN);
  if (input === undefined) return d;
  const warn = (field) => warnings.push({ path: `design.${field}`, code: `design.${field}` });
  if (!isObj(input)) { warnings.push({ path: 'design', code: 'design' }); return d; }
  const pick = (field, value, ok, set) => { if (value === undefined) return; if (ok(value)) set(value); else warn(field); };

  pick('template', input.template, (v) => v === 'basic', (v) => { d.template = v; });
  pick('palette', input.palette, (v) => Object.hasOwn(PALETTES, v), (v) => { d.palette = v; });
  pick('fontScale', input.fontScale, (v) => typeof v === 'number' && Math.round(v * 10) >= 8 && Math.round(v * 10) <= 14,
    (v) => { d.fontScale = Math.round(v * 10) / 10; });
  const L = isObj(input.layout) ? input.layout : {};
  if (input.layout !== undefined && !isObj(input.layout)) warn('layout');
  pick('layout.timetable', L.timetable, (v) => v === 'left' || v === 'right', (v) => { d.layout.timetable = v; });
  if (L.blocks !== undefined) {
    if (!isObj(L.blocks)) warn('layout.blocks');
    else for (const k of Object.keys(d.layout.blocks)) {
      pick('layout.blocks', L.blocks[k], (v) => typeof v === 'boolean', (v) => { d.layout.blocks[k] = v; });
    }
  }
  pick('layout.order', L.order, (v) => Array.isArray(v) && v.length === 3 && ['notices', 'events', 'duty'].every((x) => v.includes(x)),
    (v) => { d.layout.order = [...v]; });
  const B = isObj(input.background) ? input.background : {};
  if (input.background !== undefined && !isObj(input.background)) warn('background');
  pick('background.kind', B.kind, (v) => v === 'color' || v === 'image', (v) => { d.background.kind = v; });
  pick('background.imageId', B.imageId, (v) => v === null || imageIds.has(v), (v) => { d.background.imageId = v; });
  if (d.background.kind === 'image' && d.background.imageId === null) {
    d.background.kind = 'color';
    if (B.imageId === undefined || B.imageId === null) warn('background.imageId');
  }
  pick('background.overlay', B.overlay, (v) => typeof v === 'number' && v >= 0.5 && v <= 1, (v) => { d.background.overlay = v; });
  pick('rotateSec', input.rotateSec, (v) => Number.isInteger(v) && v >= 5 && v <= 120, (v) => { d.rotateSec = v; });
  pick('showClock', input.showClock, (v) => typeof v === 'boolean', (v) => { d.showClock = v; });
  return d;
}

function checkPeriods(c, arr, path) {
  const rows = [];
  const nos = new Set();
  let prevEnd = null;
  let classCount = 0;
  arr.forEach((r, i) => {
    const p = `${path}[${i}]`;
    if (!c.obj(r, p)) return;
    let kind = r.kind;
    if (kind !== 'class' && kind !== 'break') kind = c.err(`${p}.kind`, kind === undefined ? 'required' : 'format');
    const start = isTime(r.start) ? r.start : c.err(`${p}.start`, r.start === undefined ? 'required' : 'format');
    const end = isTime(r.end) ? r.end : c.err(`${p}.end`, r.end === undefined ? 'required' : 'format');
    if (start && end && start >= end) c.err(`${p}.end`, 'order');
    if (start && prevEnd && start < prevEnd) c.err(`${p}.start`, 'order');
    if (end) prevEnd = end;
    const label = c.str(r, 'label', `${p}.label`, { max: 10, def: '' });
    let no = null;
    if (kind === 'class') {
      classCount++;
      no = c.int(r, 'no', `${p}.no`, { min: 1, max: 12 });
      if (no !== undefined) { if (nos.has(no)) c.err(`${p}.no`, 'duplicate'); nos.add(no); }
    }
    rows.push({ no, start, end, kind, label: kind === 'break' ? label || '쉬는 시간' : '' });
  });
  if (classCount > LIMITS.classPeriodsPerDay) c.err(path, 'limit');
  return { rows, nos };
}

function checkItems(c, arr, path, nos) {
  const seen = new Set();
  return arr.map((it, i) => {
    const p = `${path}[${i}]`;
    if (!c.obj(it, p)) return null;
    const period = c.int(it, 'period', `${p}.period`, { min: 1, max: 12 });
    if (period !== undefined) {
      if (nos && !nos.has(period)) c.err(`${p}.period`, 'ref');
      if (seen.has(period)) c.err(`${p}.period`, 'duplicate');
      seen.add(period);
    }
    return { period, subject: c.str(it, 'subject', `${p}.subject`, { max: 20 }), note: c.str(it, 'note', `${p}.note`, { max: 20, def: '' }) };
  }).filter(Boolean);
}

function checkTimetable(c, data) {
  const arr = c.list(data, 'timetable', 'timetable', LIMITS.timetableVersions) ?? [];
  const froms = new Set();
  return arr.map((v, vi) => {
    const p = `timetable[${vi}]`;
    if (!c.obj(v, p)) return null;
    const effectiveFrom = c.date(v, 'effectiveFrom', `${p}.effectiveFrom`);
    if (effectiveFrom) { if (froms.has(effectiveFrom)) c.err(`${p}.effectiveFrom`, 'duplicate'); froms.add(effectiveFrom); }
    const base = checkPeriods(c, c.list(v, 'periods', `${p}.periods`, LIMITS.periodRows, { required: true, min: 1 }) ?? [], `${p}.periods`);

    const periodsByDay = {};
    const nosByDay = {};
    if (v.periodsByDay !== undefined && c.obj(v.periodsByDay, `${p}.periodsByDay`)) {
      for (const wd of DAYS) {
        const rows = c.list(v.periodsByDay, wd, `${p}.periodsByDay.${wd}`, LIMITS.periodRows) ?? [];
        if (!rows.length) continue;
        const r = checkPeriods(c, rows, `${p}.periodsByDay.${wd}`);
        periodsByDay[wd] = r.rows;
        nosByDay[wd] = r.nos;
      }
    }
    const nosFor = (wd) => nosByDay[wd] ?? base.nos;

    const week = {};
    const w = v.week === undefined ? c.err(`${p}.week`, 'required') : c.obj(v.week, `${p}.week`);
    for (const wd of DAYS) {
      const items = w ? c.list(w, wd, `${p}.week.${wd}`, LIMITS.classPeriodsPerDay) ?? [] : [];
      week[wd] = checkItems(c, items, `${p}.week.${wd}`, nosFor(wd));
    }

    const dates = new Set();
    const overrides = (c.list(v, 'overrides', `${p}.overrides`, LIMITS.overrides) ?? []).map((o, oi) => {
      const op = `${p}.overrides[${oi}]`;
      if (!c.obj(o, op)) return null;
      const date = c.date(o, 'date', `${op}.date`);
      if (date) { if (dates.has(date)) c.err(`${op}.date`, 'duplicate'); dates.add(date); }
      const items = c.list(o, 'items', `${op}.items`, LIMITS.classPeriodsPerDay, { required: true }) ?? [];
      return {
        date, replaceAll: c.bool(o, 'replaceAll', `${op}.replaceAll`, false),
        items: checkItems(c, items, `${op}.items`, date ? nosFor(weekdayOf(date)) : null),
      };
    }).filter(Boolean);

    return { effectiveFrom, periods: base.rows, week, periodsByDay, overrides };
  }).filter(Boolean);
}

function checkNoClass(c, data) {
  return (c.list(data, 'noClass', 'noClass', LIMITS.noClass) ?? []).map((n, i) => {
    const p = `noClass[${i}]`;
    if (!c.obj(n, p)) return null;
    const startDate = c.date(n, 'startDate', `${p}.startDate`);
    const endDate = c.date(n, 'endDate', `${p}.endDate`);
    if (startDate && endDate && endDate < startDate) c.err(`${p}.endDate`, 'order');
    return { startDate, endDate, label: c.str(n, 'label', `${p}.label`, { min: 1, max: 20 }) };
  }).filter(Boolean);
}

function checkEvents(c, data) {
  const arr = c.list(data, 'events', 'events', LIMITS.events) ?? [];
  c.ids(arr, 'events');
  return arr.map((e, i) => {
    const p = `events[${i}]`;
    if (!c.obj(e, p)) return null;
    const date = c.date(e, 'date', `${p}.date`);
    const endDate = c.date(e, 'endDate', `${p}.endDate`, { nullable: true });
    if (date && endDate && endDate < date) c.err(`${p}.endDate`, 'order');
    let time = c.str(e, 'time', `${p}.time`, { max: 5, def: '' });
    if (time && !isTime(time)) time = c.err(`${p}.time`, 'format');
    return {
      id: e.id, date, endDate, time,
      title: c.str(e, 'title', `${p}.title`, { min: 1, max: 40 }),
      note: c.str(e, 'note', `${p}.note`, { max: 100, def: '' }),
    };
  }).filter(Boolean);
}

function checkNotices(c, data, imageIds, today, warnings) {
  const arr = c.list(data, 'notices', 'notices', LIMITS.notices) ?? [];
  c.ids(arr, 'notices');
  const out = arr.map((n, i) => {
    const p = `notices[${i}]`;
    if (!c.obj(n, p)) return null;
    const startDate = c.date(n, 'startDate', `${p}.startDate`);
    const endDate = c.date(n, 'endDate', `${p}.endDate`, { nullable: true });
    if (startDate && endDate && endDate < startDate) c.err(`${p}.endDate`, 'order');
    let imageId = n.imageId ?? null;
    if (imageId !== null && !imageIds.has(imageId)) imageId = c.err(`${p}.imageId`, 'ref');
    return {
      id: n.id,
      title: c.str(n, 'title', `${p}.title`, { min: 1, max: LIMITS.noticeTitle }),
      body: c.str(n, 'body', `${p}.body`, { max: LIMITS.noticeBody, def: '', allowLf: true }),
      important: c.bool(n, 'important', `${p}.important`, false),
      startDate, endDate,
      order: c.int(n, 'order', `${p}.order`, { min: -9999, max: 9999, def: 0 }),
      imageId,
      imageAlt: c.str(n, 'imageAlt', `${p}.imageAlt`, { max: 100, def: '' }),
    };
  }).filter(Boolean);
  if (today) {
    if (out.filter((n) => n.endDate === null || n.endDate >= today).length > LIMITS.activeNotices) c.err('notices', 'limit');
    const old = out.filter((n) => n.endDate && daysBetween(n.endDate, today) > 90).length;
    if (old) warnings.push({ path: 'notices', code: 'oldNotices', count: old });
  }
  return out;
}

const MASKED_RE = /^\S○{1,9}$/u;
const FULL_RE = /^[^\s\u0000-\u001F\u007F]{1,10}$/u;

function checkDuty(c, data) {
  const d = data.duty === undefined ? {} : c.obj(data.duty, 'duty');
  if (!d) return undefined;
  const rawZones = c.list(d, 'zones', 'duty.zones', LIMITS.zones) ?? [];
  c.ids(rawZones, 'duty.zones');
  const zones = rawZones.map((z, i) => {
    if (!c.obj(z, `duty.zones[${i}]`)) return null;
    return { id: z.id, name: c.str(z, 'name', `duty.zones[${i}].name`, { min: 1, max: 20 }) };
  }).filter(Boolean);
  const zoneIds = new Set(zones.map((z) => z.id));

  let nameMode = d.nameMode ?? 'number';
  if (!['number', 'masked', 'full'].includes(nameMode)) nameMode = c.err('duty.nameMode', 'format');
  const nos = new Set();
  const students = (c.list(d, 'students', 'duty.students', LIMITS.students) ?? []).map((s, i) => {
    const p = `duty.students[${i}]`;
    if (!c.obj(s, p)) return null;
    const no = c.int(s, 'no', `${p}.no`, { min: 1, max: 99 });
    if (no !== undefined) { if (nos.has(no)) c.err(`${p}.no`, 'duplicate'); nos.add(no); }
    if (s.name === undefined) return { no };
    const ok = typeof s.name === 'string' && (nameMode === 'masked' ? MASKED_RE.test(s.name) : nameMode === 'full' && FULL_RE.test(s.name));
    if (!ok) c.err(`${p}.name`, 'name');
    return { no, name: s.name };
  }).filter(Boolean);

  let mode = d.mode ?? 'rotate';
  if (mode !== 'rotate' && mode !== 'fixed') mode = c.err('duty.mode', 'format');

  let rotate = null;
  if (d.rotate !== undefined && d.rotate !== null && c.obj(d.rotate, 'duty.rotate')) {
    let unit = d.rotate.unit;
    if (unit !== 'week' && unit !== 'day') unit = c.err('duty.rotate.unit', unit === undefined ? 'required' : 'format');
    rotate = {
      startDate: c.date(d.rotate, 'startDate', 'duty.rotate.startDate'), unit,
      perZone: c.int(d.rotate, 'perZone', 'duty.rotate.perZone', { min: 1, max: 10 }),
    };
    if (mode === 'rotate' && rotate.perZone && zones.length * rotate.perZone > students.length) c.err('duty.rotate.perZone', 'range');
  } else if (mode === 'rotate' && zones.length) c.err('duty.rotate', 'required');

  let fixed = null;
  if (d.fixed !== undefined && d.fixed !== null && c.obj(d.fixed, 'duty.fixed')) {
    fixed = {};
    for (const wd of DAYS) {
      const day = d.fixed[wd] === undefined ? {} : c.obj(d.fixed[wd], `duty.fixed.${wd}`) ?? {};
      fixed[wd] = {};
      for (const [zid, list] of Object.entries(day)) {
        const p = `duty.fixed.${wd}.${zid}`;
        if (!zoneIds.has(zid)) c.err(p, 'ref');
        if (!Array.isArray(list)) { c.err(p, 'type'); continue; }
        list.forEach((no, i) => { if (!nos.has(no)) c.err(`${p}[${i}]`, 'ref'); });
        fixed[wd][zid] = [...list];
      }
    }
  } else if (mode === 'fixed' && zones.length) c.err('duty.fixed', 'required');

  const swaps = (c.list(d, 'swaps', 'duty.swaps', LIMITS.swaps) ?? []).map((s, i) => {
    const p = `duty.swaps[${i}]`;
    if (!c.obj(s, p)) return null;
    if (!zoneIds.has(s.zoneId)) c.err(`${p}.zoneId`, 'ref');
    const from = c.int(s, 'from', `${p}.from`, { min: 1, max: 99 });
    let to = s.to ?? null;
    if (to !== null && !nos.has(to)) to = c.err(`${p}.to`, 'ref');
    return { date: c.date(s, 'date', `${p}.date`), zoneId: s.zoneId, from, to };
  }).filter(Boolean);

  return { zones, students, nameMode, mode, rotate, fixed, swaps, note: c.str(d, 'note', 'duty.note', { max: 100, def: '' }) };
}
