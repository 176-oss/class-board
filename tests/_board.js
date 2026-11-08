// 테스트 공용 자료. 이름이 *.test.js 가 아니라 node --test 가 따로 실행하지 않는다.
import { validateBoard } from '../js/core/schema.js';

// 서울 시각을 UTC 밀리초로. KST = UTC + 9.
export const kst = (y, m, d, hh = 0, mm = 0, ss = 0) => Date.UTC(y, m - 1, d, hh - 9, mm, ss);

export const PERIODS = [
  { kind: 'class', no: 1, start: '09:00', end: '09:45' },
  { kind: 'class', no: 2, start: '09:55', end: '10:40' },
  { kind: 'class', no: 3, start: '10:50', end: '11:35' },
  { kind: 'class', no: 4, start: '11:45', end: '12:30' },
  { kind: 'break', start: '12:30', end: '13:20', label: '점심' },
  { kind: 'class', no: 5, start: '13:20', end: '14:05' },
  { kind: 'class', no: 6, start: '14:15', end: '15:00' },
];

const SUBJECTS = ['국어', '수학', '사회', '과학', '영어', '음악'];
const day = (wd) => SUBJECTS.map((s, i) => ({ period: i + 1, subject: `${wd}-${s}` }));

export function rawBoard(extra = {}) {
  return {
    kind: 'class-board', schemaVersion: 1, rev: 1, updatedAt: '2026-11-10T08:00:00+09:00', title: '3학년 2반',
    timetable: [{ effectiveFrom: '2026-03-02', periods: PERIODS, week: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri'].map((w) => [w, day(w)])) }],
    ...extra,
  };
}

// 함수들은 언제나 검사를 통과한 값만 받으므로 테스트도 그렇게 만든다.
export function board(extra = {}) {
  const r = validateBoard(rawBoard(extra));
  if (!r.ok) throw new Error('시험 자료 오류: ' + JSON.stringify(r.errors));
  return r.board;
}
