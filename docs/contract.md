# 학급 디지털 게시판 계약 문서 (contract)

작성: 기획 담당 / 2026-11-08 / 기준: `docs/기획서.md` v0.2(이하 기획서), `docs/spike.md`(이하 스파이크).
모든 담당은 이 문서의 파일 이름, 데이터 모양, 함수 서명, 문구를 그대로 따른다. 바꿔야 하면 이 문서를 먼저 고치고 상대 담당에게 알린다.
경로는 저장소 `176-oss/class-board` 루트 기준이다 (기획서의 `board/...` = 루트). `spike/`는 건드리지 않는다.

## 0. 공통 규칙
- 정적 파일, 빌드 없음, ES 모듈. 외부 코드·CDN·외부 글꼴 금지. 유일한 외부 스크립트는 입력 화면의 `https://accounts.google.com/gsi/client`이며 HTML에 적지 않고 로그인할 때 `js/admin/drive.js`가 `<script>`를 만들어 넣는다. 표시 화면에는 외부 스크립트가 없다.
- 데이터를 보내는 곳: `accounts.google.com`(로그인), `www.googleapis.com/drive/v3`, `/upload/drive/v3`, `/download/drive/v3`뿐.
- HTML 문자열을 요소에 넣는 속성·메서드(inner/outer HTML 속성, insertAdjacent 계열, document 쓰기), `eval`, `new Function` 금지. 코드와 주석에 그 이름도 쓰지 않는다 (기획서 16절 6번 검색에 걸림). 글은 모두 `textContent`, 서식은 줄바꿈과 `strong` 노드만, `a` 요소 금지.
- 이모지·장식 기호 문자 금지 (예외: 데이터로서 `masked` 이름의 `○`, 7절). 아이콘은 단색 인라인 SVG.
- `js/core/` 모듈은 순수 함수만: DOM, `window`, `document`, `localStorage`, `indexedDB`, `caches`, `fetch`, `navigator`를 쓰지 않는다. `Intl`, `TextEncoder`, `crypto.getRandomValues`는 써도 된다. 시각은 항상 인자(`nowMs`)로 받는다 (`Date.now()` 직접 호출 금지).
- 테스트: `node --test tests/` (Node 26, `node:test` + `node:assert/strict`). 테스트 파일 이름은 `tests/*.test.js`. `package.json`은 두지 않는다 (Node 26이 ES 모듈을 알아서 판단). ES 모듈은 import가 먼저 실행되므로, 테스트 첫 줄의 `process.env.TZ` 변경은 import 때 PC 시간대를 쓰지 않는 모듈에만 통한다.
- 날짜는 'YYYY-MM-DD' 문자열, 시각은 'HH:MM'(24시간) 문자열로 비교한다. 날짜·시각 계산은 모두 `Intl.DateTimeFormat(..., { timeZone: 'Asia/Seoul' })` 기준 (PC 시간대 무시).
- 파일 ID는 `isValidFileId`를 통과할 때만 쓰고 URL에는 `encodeURIComponent`를 적용한다. 통과하지 않으면 어떤 요청도 보내지 않는다.
- 문구는 쉬운 한국어, 버튼 이름은 동사로 끝낸다. 이 문서에 원문이 있는 문구는 그대로 쓴다.

## 1. 파일과 모듈

| 경로 | 역할 | 담당 |
|---|---|---|
| `config.js` | 아래 원문 | A |
| `index.html` | 표시 화면 뼈대, `?f=파일ID`, 외부 스크립트 없음, `<meta name="referrer">` 넣지 않음 | A |
| `admin.html` | 입력 화면 뼈대 | B |
| `sw.js` | 서비스 워커 (8절) | A |
| `fonts/IBMPlexSansKR-Regular.woff2`, `-Medium.woff2`, `-SemiBold.woff2`, `fonts/OFL-LICENSE.txt` | `textgenerator-v2/lib/fonts/`에서 복사 | A |
| `css/tokens.css` | `@font-face`(fonts/), 공통 크기·간격·굵기 토큰. 색은 넣지 않는다 (색은 `js/core/palette.js`가 유일한 원본) | A |
| `css/board.css` | 표시 화면 배치 (10절) | A |
| `css/admin.css` | 입력 화면 배치. 입력 화면 색은 4-3절 표 값을 변수로 둔다 | B |
| `js/core/schema.js` | `LIMITS`, `DEFAULT_DESIGN`, `defaultBoard`, `validateBoard` | A |
| `js/core/time.js` | `seoulNow`, `seoulIso`, `isDate`, `isTime`, `addDays`, `daysBetween`, `weekdayOf`, `mondayOf` | A |
| `js/core/timetable.js` | `todayTimetable` | A |
| `js/core/notices.js` | `activeNotices`, `pageNotices`, `richLines`, `noticeChars` | A |
| `js/core/events.js` | `eventsView` | A |
| `js/core/duty.js` | `dutyFor`, `maskName` | A |
| `js/core/palette.js` | `PALETTES`, `contrastRatio`, `checkPalette` | A |
| `js/core/net.js` | `startDelay`, `backoffDelay`, `connectRetryDelay`, `staleness`, `clockSkew`, `isDawnReload` | A |
| `js/core/ids.js` | `isValidFileId`, `randomId`, `boardFileName`, `imageFileName`, `historyFileName`, `parseHistoryName` | A |
| `js/core/privacy.js` | `phoneWarning` | A |
| `js/core/drive-common.js` | 주소 상수와 만드는 함수, `DriveError`, `classifyDriveError`, `ADMIN_MESSAGES`, `DISPLAY_TEXT`, `isFakeMode`, `SCOPES` | A |
| `js/core/fake-drive.js` | `createFakeDrive` (가짜 드라이브, 브라우저·node 공용, 6절) | B |
| `js/core/diff.js` | `diffBoards` ([차이 보기]) | B |
| `js/core/install.js` | `displayUrl`, `commandLine`, `installBat`, `uninstallBat` (11절) | B |
| `js/core/image-fit.js` | `fitSize(w, h, max = 1600)` → `{ w, h }` | B |
| `js/fake-store.js` | 가짜 드라이브 브라우저 저장소 (localStorage + Cache Storage, 6절) | B |
| `js/display/main.js` | 표시 화면 시작, 확인 주기, 백오프, 캐시, 커서, Wake Lock, 재로드 (9절) | A |
| `js/display/source.js` | `createKeySource({ apiKey })`: 로그인 없는 읽기 (DisplaySource, 5-5) | A |
| `js/display/render.js` | `renderBoard(root, board, ctx)`: DOM만, fetch 없음. 입력 화면 미리보기도 이것을 쓴다 | A |
| `js/display/images.js` | 이미지 Cache Storage 보관과 정리 | A |
| `js/admin/*.js` | 입력 화면 (`main.js`, `drive.js` = AdminDrive 실제 구현, 탭별 모듈, `image.js` canvas 처리). 안쪽 나눔은 B 자유 | B |
| `tests/*.test.js` | A: core의 A 모듈 전부 + `sw-shell.test.js`(index.html이 불러오는 파일이 모두 `sw.js`의 `SHELL`에 있는지). B: fake-drive, diff, install, image-fit | A/B |
| `tests/fixtures/board-sample.json`, `board-worst.json` | 정상 예시, 최악 데이터(기획서 16절 10번 분량) | A |
| `docs/설치-운영-안내서.md` | 선생님용 설치·운영 안내서 (기획서 12절, 9절 인수인계 한 문단) | B |

`config.js` 원문:
```js
// OAuth 클라이언트 ID는 바꾸지 않는다 (drive.file은 클라이언트 단위라 바꾸면 기존 게시판 파일을 잃는다).
export const GOOGLE_CLIENT_ID = '297618998858-87efuloh6pg3dp9got59imfe930pppaq.apps.googleusercontent.com';
// 별도 Cloud 프로젝트의 API 키 (HTTP 참조 https://176-oss.github.io/*, Drive API만). 선생님이 넣는다.
export const DRIVE_API_KEY = '';
```

A가 먼저 만드는 것: `js/core/schema.js`, `time.js`, `drive-common.js`, `ids.js`, `palette.js` (B가 import함). 나올 때까지 B는 이 문서의 서명대로 임시 함수를 써도 되지만 저장소에 올리지 않는다. `render.js`가 나오기 전 B의 미리보기는 빈 상자.

## 2. 데이터 (`board-<무작위12자>.json`)

### 2-1. 최상위

| 필드 | 타입 | 필수 | 기본값 | 형식·상한 |
|---|---|---|---|---|
| `kind` | string | 예 | | `'class-board'` 정확히. 다르면 오류 `kind` |
| `schemaVersion` | integer | 예 | | 1 이상. 이 화면은 1을 안다 (`SUPPORTED_SCHEMA = 1`) |
| `minReader` | integer | 아니오 | 1 | 이 파일을 바르게 읽으려면 필요한 최소 화면 스키마. `minReader > 1`이면 해석 불가 (2-9) |
| `rev` | integer | 예 | | 1 이상. 저장마다 서버 rev + 1 (5-6) |
| `updatedAt` | string | 예 | | `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z\|[+-]\d{2}:\d{2})$/` 이고 `Date.parse` 가능. 입력 화면은 `seoulIso(nowMs)`로 `+09:00` 형식을 쓴다 |
| `title` | string | 예 | | 1~40자 (학급 이름) |
| `design` | object | 아니오 | `DEFAULT_DESIGN` | 2-2 |
| `timetable` | array | 아니오 | `[]` | 버전 1~10개 (첫 UI는 1개만 다룸), 2-3 |
| `noClass` | array | 아니오 | `[]` | 최대 100개, 2-4 |
| `events` | array | 아니오 | `[]` | 최대 200개, 2-5 |
| `notices` | array | 아니오 | `[]` | 전체 최대 200개, 그중 '끝나지 않은 것'(`endDate`가 null이거나 `updatedAt`의 서울 날짜 이상) 최대 50개, 2-6 |
| `images` | array | 아니오 | `[]` | 최대 20개, 2-7 |
| `duty` | object | 아니오 | 2-8 기본값 | 2-8 |

- 글자 수는 코드 포인트 기준 (`[...s].length`). 모든 문자열에서 제어 문자(`\u0000-\u001F`, `\u007F`)는 오류. 예외: 안내 `body`의 `\n`.
- 파일 크기: UTF-8 바이트(`new TextEncoder().encode(text).length`) 204800 초과면 오류 `tooBig`, 153600 초과면 경고 `size150`.
- `id` 필드(안내, 일정, 이미지, 구역): `/^[A-Za-z0-9_-]{1,40}$/`, 같은 목록 안에서 겹치지 않음. 새 id는 `randomId(10)`.
- 미지의 필드는 무시하고 정규화된 결과에서 뺀다. 그래서 입력 화면은 `schemaVersion > 1`인 파일을 **저장하지 않는다** (2-9).

### 2-2. `design` (값이 틀리면 오류가 아니라 그 필드만 기본값 + 경고 `design.<필드>`)

| 필드 | 타입 | 기본값 | 허용 |
|---|---|---|---|
| `template` | string | `'basic'` | `'basic'`만 |
| `palette` | string | `'honey'` | `'honey' \| 'brown' \| 'sand' \| 'night'` (4절) |
| `fontScale` | number | 1.0 | 0.8~1.4, 0.1 단위 (반올림 후 범위 밖이면 기본값) |
| `layout.timetable` | string | `'left'` | `'left' \| 'right'` |
| `layout.blocks` | object | 모두 true | `{ timetable, notices, events, duty }` 각 boolean. 모두 false도 허용 (위 띠만) |
| `layout.order` | array | `['notices','events','duty']` | 이 세 값의 순열. 아니면 기본값 |
| `background.kind` | string | `'color'` | `'color' \| 'image'` |
| `background.imageId` | string\|null | null | `kind:'image'`면 `images[].id` 중 하나. 없으면 `kind:'color'`로 |
| `background.overlay` | number | 0.85 | 0.5~1.0. 배경 이미지 위에 덮는 바탕색(`bg`)의 불투명도 |
| `rotateSec` | integer | 15 | 5~120 |
| `showClock` | boolean | true | |

`design.layout.free`(2단계)는 지금 무시한다. 넣을 때 `schemaVersion`을 올린다.

### 2-3. `timetable[]` (버전)

| 필드 | 타입 | 필수 | 형식·규칙 |
|---|---|---|---|
| `effectiveFrom` | string | 예 | 날짜. 버전끼리 겹치지 않음. 그날 적용 버전 = `effectiveFrom <= 오늘`인 것 중 가장 늦은 것 |
| `periods` | array | 예 | 1~20행. 행 `{ no, start, end, kind, label }` |
| `periods[].kind` | string | 예 | `'class' \| 'break'` |
| `periods[].no` | integer | class면 예 | class 행: 1~12, class 행끼리 겹치지 않음 = 'n교시'. break 행의 `no`는 무시 (기획서 예시의 점심 `no:5`는 쓰지 않는 값) |
| `periods[].start`, `end` | string | 예 | `/^([01]\d\|2[0-3]):[0-5]\d$/`, `start < end`, 다음 행 `start >= 이전 행 end` (행은 시작 시각 순). 위반은 오류 (입력 화면은 저장을 막음) |
| `periods[].label` | string | 아니오 | 0~10자. break 기본 '쉬는 시간', class는 쓰지 않음 |
| `week` | object | 예 | 키 `mon`~`fri`, 각 배열 최대 12개 `{ period, subject, note }` |
| `week.*[].period` | integer | 예 | 그 요일 교시표의 class `no` 중 하나 |
| `week.*[].subject` | string | 예 | 0~20자. `''`이면 그 교시 표시 안 함 |
| `week.*[].note` | string | 아니오 | 0~20자, 기본 `''` |
| `periodsByDay` | object | 아니오 | 키 `mon`~`fri`, 값은 `periods`와 같은 규칙. 없거나 빈 배열이면 `periods` 사용 |
| `overrides` | array | 아니오 | 최대 400개 `{ date, replaceAll, items }`, 같은 버전 안에서 `date` 겹치지 않음 |
| `overrides[].replaceAll` | boolean | 아니오 | 기본 false |
| `overrides[].items` | array | 예 | 최대 12개, `week` 항목과 같은 모양. `subject:''` = 그 교시 없음 |

### 2-4. `noClass[]`
`{ startDate, endDate, label }`: 날짜, 날짜(`>= startDate`, 하루짜리도 같은 날짜를 넣음), 1~20자. 공휴일도 선생님이 여기에 넣는다 (목록 번들 없음).

### 2-5. `events[]`
| 필드 | 타입 | 필수 | 형식 |
|---|---|---|---|
| `id` | string | 예 | id 형식 |
| `date` | string | 예 | 날짜 |
| `endDate` | string\|null | 아니오 | null(하루) 또는 `>= date` |
| `time` | string | 아니오 | `''` 또는 HH:MM, 기본 `''` |
| `title` | string | 예 | 1~40자 |
| `note` | string | 아니오 | 0~100자 |

### 2-6. `notices[]`
| 필드 | 타입 | 필수 | 기본값 | 형식 |
|---|---|---|---|---|
| `id` | string | 예 | | id 형식 |
| `title` | string | 예 | | 1~40자 |
| `body` | string | 아니오 | `''` | 0~500자, `\n` 허용, 굵게는 `**글**` (`richLines`) |
| `important` | boolean | 아니오 | false | |
| `startDate` | string | 예 | | 날짜 |
| `endDate` | string\|null | 아니오 | null | null(상시) 또는 `>= startDate` |
| `order` | integer | 아니오 | 0 | -9999~9999, 작을수록 먼저 |
| `imageId` | string\|null | 아니오 | null | `images[].id` 중 하나. 없는 id면 오류 |
| `imageAlt` | string | 아니오 | `''` | 0~100자. 비면 `images[].alt` 사용 |

### 2-7. `images[]`
`{ id, fileId, alt, w, h }`: id 형식, `isValidFileId`, 0~100자, 정수 1~1600, 정수 1~1600. 파일은 언제나 JPEG(`img-<12자>.jpg`, `image/jpeg`, 약 500KB 이하).
연결 규칙:
- `notices[].imageId`와 `design.background.imageId`만 이미지를 가리킨다. 한 이미지를 여러 곳이 가리켜도 된다.
- 입력 화면은 저장에 성공한 뒤, 직전 저장본의 `images`에 있었는데 새 저장본에 없는 `fileId`를 `files.delete`한다 (안내를 지우면 그 안내만 가리키던 이미지도 목록에서 빠지고 영구 삭제). 아무도 가리키지 않는 이미지는 이미지 탭에서 보이며 사용자가 지울 수 있다.
- 표시 화면은 오늘 보여 줄 안내와 배경이 가리키는 이미지만 받는다.

### 2-8. `duty`
| 필드 | 타입 | 필수 | 기본값 | 형식 |
|---|---|---|---|---|
| `zones` | array | 아니오 | `[]` | 최대 12개 `{ id, name }`, name 1~20자 |
| `students` | array | 아니오 | `[]` | 최대 60개 `{ no, name? }`, no 정수 1~99 겹침 없음 |
| `nameMode` | string | 아니오 | `'number'` | `'number' \| 'masked' \| 'full'` |
| `mode` | string | 아니오 | `'rotate'` | `'rotate' \| 'fixed'` |
| `rotate` | object | rotate면 예 | | `{ startDate: 날짜, unit: 'week'\|'day', perZone: 1~10 }`, `zones.length * perZone <= students.length` (아니면 오류 `duty.rotate.perZone`) |
| `fixed` | object | fixed면 예 | | 키 `mon`~`fri`, 값 `{ [zoneId]: [no, ...] }`. zoneId는 `zones`에, no는 `students`에 있어야 함 |
| `swaps` | array | 아니오 | `[]` | 최대 50개 `{ date, zoneId, from, to }` (오늘 하루 교체, `to: null`이면 빼기). 입력 화면은 저장할 때 오늘보다 앞선 항목을 지운다 |
| `note` | string | 아니오 | `''` | 0~100자 |

`nameMode`별 `students[].name`:
| nameMode | 파일에 `name` | 형식 | 표시 예 |
|---|---|---|---|
| `number` | **절대 없음**. 하나라도 있으면 `validateBoard` 오류 `duty.students.name`. 입력 화면은 이름 대응표를 메모리에만 두고 저장 전에 지운다 | | '3번' |
| `masked` | 가린 글만 (`maskName(전체이름)` 결과). 전체 이름은 파일에 넣지 않는다 | `/^\S○{1,9}$/u` | '3번 김○○' |
| `full` | 전체 이름 | 1~10자, 공백·제어 문자 없음 | '3번 김하늘' |
`name`이 없는 학생은 모드와 상관없이 번호만 표시한다.

### 2-9. 검사 결과 처리
| 상황 | `validateBoard` 결과 | 표시 화면 | 입력 화면 |
|---|---|---|---|
| 정상 | `{ ok: true, board, warnings, newer: false }` | 표시하고 저장 | 편집 |
| `schemaVersion > 1`, `minReader <= 1` | `{ ok: true, board(알려진 필드만), warnings, newer: true }` | 알려진 필드만 표시 | 열람만, [저장] 막음: '더 새 버전의 입력 화면에서 저장한 게시판입니다. 새로고침하세요' |
| `minReader > 1` | `{ ok: false, needsUpdate: true, errors: [{ path: 'minReader', code: 'schemaMajor' }] }` | 마지막 정상 내용 유지 + 구석 '화면 업데이트 필요' | 같은 문구로 열지 않음 |
| 그 밖 오류 (kind, 형식, 상한, JSON 파싱 실패, 200KB 초과) | `{ ok: false, needsUpdate: false, errors: [{ path, code }] }` | 마지막 정상 내용 유지 + 구석 '내용을 읽지 못해 이전 내용을 표시합니다' | 열지 않고 '게시판 파일 내용이 올바르지 않습니다' |

## 3. 순수 함수 계약

`board`는 언제나 `validateBoard`를 통과한 정규화된 값이다 (기본값이 채워져 있음). 함수는 인자를 바꾸지 않는다.

### 3-1. `schema.js`
```js
export const SUPPORTED_SCHEMA = 1;
export const LIMITS = { activeNotices: 50, notices: 200, noticeTitle: 40, noticeBody: 500, events: 200, classPeriodsPerDay: 12,
  periodRows: 20, zones: 12, students: 60, images: 20, bytes: 204800, warnBytes: 153600, noClass: 100, overrides: 400, swaps: 50, timetableVersions: 10 };
export const DEFAULT_DESIGN = { template: 'basic', palette: 'honey', fontScale: 1.0,
  layout: { timetable: 'left', blocks: { timetable: true, notices: true, events: true, duty: true }, order: ['notices', 'events', 'duty'] },
  background: { kind: 'color', imageId: null, overlay: 0.85 }, rotateSec: 15, showClock: true };
export function defaultBoard(title, nowMs): Board
// rev 1, updatedAt seoulIso(nowMs), timetable 1개(effectiveFrom 오늘, 아래 기본 교시표, week 빈 배열), duty 기본값
// 기본 교시표: 1 09:00-09:45, 2 09:55-10:40, 3 10:50-11:35, 4 11:45-12:30, break '점심' 12:30-13:20, 5 13:20-14:05, 6 14:15-15:00, 7 15:10-15:55
export function validateBoard(input: string | object): Result
// string이면 바이트 검사 후 JSON.parse (실패 = code 'json'). object면 JSON.stringify 길이로 바이트 검사.
// Result는 2-9 표. errors: [{ path: 'notices[3].title', code }], code: 'json'|'tooBig'|'kind'|'schemaMajor'|'required'|'type'|'format'|'limit'|'range'|'ref'|'duplicate'|'order'|'name'
// warnings: [{ path, code }], code: 'size150' | 'design.<필드>' | 'oldNotices'(끝난 지 90일 넘은 안내가 있음, 개수 count 포함)
```

### 3-2. `time.js`
```js
seoulNow(dateMs): { date: 'YYYY-MM-DD', time: 'HH:MM', weekday: 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun', seconds: 0..59 }
  // Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', hourCycle: 'h23', ... }).formatToParts. '24:00' 이 나오지 않게 h23
seoulIso(dateMs): '2026-11-08T19:30:00+09:00'
isDate(s): boolean      // 형식 + 실제 있는 날짜 (2026-02-30 false)
isTime(s): boolean
addDays(date, n): date  // UTC 정오 기준 계산 (시간대 영향 없음)
daysBetween(a, b): integer  // b - a 일수
weekdayOf(date): 'mon'..'sun'
mondayOf(date): date
```

### 3-3. `timetable.js`
```js
todayTimetable(board, nowMs): {
  status: 'class' | 'weekend' | 'noClass' | 'none',  // none: 적용 버전 없음 또는 오늘 보일 class 교시가 없음
  label: string,          // noClass면 그 label, weekend면 '주말', 아니면 ''
  rows: [{ kind: 'class'|'break', no, label /* class: 'n교시' */, start, end, subject, note,
           state: 'past' | 'now' | 'next' | 'future' }]
}
```
규칙: (1) 오늘 = `seoulNow(nowMs).date`. (2) `noClass` 범위(양끝 포함)에 들면 `noClass` (주말보다 먼저). (3) 토·일은 `weekend`. (4) 적용 버전의 그 요일 교시표(`periodsByDay[wd]` 또는 `periods`)에 `week[wd]`를 `period`=`no`로 붙인다. (5) 오늘 날짜의 `overrides`: `replaceAll:false`면 교시 단위로 덮고, `replaceAll:true`면 `week[wd]`를 버리고 `items`만 쓴다. (6) `subject`가 `''`이거나 항목이 없는 class 행은 뺀다. break 행은 class 행이 하나라도 남으면 모두 남긴다. (7) state: 현재 시각 t에서 `start <= t < end`인 행이 `now`, `end <= t`면 `past`, 나머지는 `future`. `now`인 class 행이 없으면 `start > t`인 첫 class 행을 `next`로 (break가 `now`일 때도 같음).

### 3-4. `notices.js`
```js
activeNotices(board, date): Notice[]
  // startDate <= date && (endDate === null || date <= endDate). 정렬: important(true 먼저) → order 오름 → startDate 오름 → id 오름
noticeChars(n): integer          // [...title].length + [...body].length
pageNotices(list, { rotateSec, fontScale = 1 }): { pinned: Notice[], pages: [{ items: Notice[], sec: integer }] }
  // pinned: list 중 important 앞에서 최대 2개 (제목만 모든 페이지 위 띠에 보임). pages에는 pinned 포함 전부.
  // PAGE_CHARS = Math.floor(600 / fontScale), PAGE_ITEMS = 3. 차례로 넣되 (합계 + 이번 글자수 <= PAGE_CHARS && 개수 < 3)이 아니면 새 페이지.
  // 혼자 PAGE_CHARS를 넘는 안내는 혼자 한 페이지. 이미지가 있는 안내는 혼자 한 페이지.
  // sec = max(rotateSec, ceil(페이지 글자수 합 / 8)). list가 비면 pages: [].
  // PAGE_CHARS 600은 A가 16절 10번 스크린샷에서 잘림이 없게 조정할 수 있다 (상수만, 서명은 그대로).
richLines(body): Array<Array<{ text, bold }>>   // '\n'으로 줄 나눔, 짝이 맞는 '**' 사이만 bold. 짝 없는 '**'는 글자 그대로
```

### 3-5. `events.js`
```js
eventsView(board, date, limit = 5): { items: [{ id, title, date, endDate, time, note, dday: 'D-Day' | 'D-n', state: 'ongoing' | 'upcoming' }], more: integer }
  // 끝(endDate ?? date) < date 이면 숨김. date <= 오늘 <= 끝이면 'D-Day'·ongoing, 시작 전이면 'D-' + daysBetween(오늘, date).
  // 정렬: date → time('' 이 먼저) → id. limit 넘는 수는 more ('외 n건'으로 표시).
```

### 3-6. `duty.js`
```js
dutyFor(duty, date, swaps = duty.swaps): {
  status: 'ok' | 'before' | 'weekend' | 'none',   // none: 구역이나 학생이 없음, before: rotate 시작일 전
  startDate: date | null,                         // before일 때 시작일 ('11월 9일부터' 표시용)
  zones: [{ id, name, students: [{ no, label }] }]
}
maskName(fullName): string   // 첫 글자 + '○' × (나머지 글자 수, 최소 1). '김하늘' → '김○○', '이' → '이○'
```
규칙: 학생은 `no` 오름차순. rotate: k = `unit:'week'`면 `daysBetween(mondayOf(startDate), mondayOf(date)) / 7`, `unit:'day'`면 `startDate <= d < date`인 평일(월~금) 수. `date < startDate`면 `before`. 토·일은 `weekend`. offset = (k × 구역 수 × perZone) mod 학생 수. j번째 구역의 i번째 당번 = 학생[(offset + j × perZone + i) mod 학생 수]. fixed: `fixed[wd][zoneId]`. swaps: `swap.date === date`인 것만, 해당 구역에서 `from`을 찾아 `to`로 그 자리 교체(`to: null`이면 빼기), `from`이 없으면 무시. label: 2-8 표.

### 3-7. `palette.js`
```js
export const PALETTES = { honey: {...}, brown: {...}, sand: {...}, night: {...} };  // 4-1 표 값 그대로
contrastRatio(hexA, hexB): number    // WCAG 2.x 상대 휘도, '#RRGGBB'만. 소수 그대로 (반올림은 표시할 때)
checkPalette(p): { ok: boolean, pairs: [{ fg, bg, ratio }] }
  // 검사 쌍: text·muted·accent·title·warn 각각 × bg·surface (10쌍) + onFill × fill. 모두 >= 4.5면 ok
```

### 3-8. `net.js`
```js
startDelay(hasCache, rand): ms         // hasCache면 rand × 60000, 아니면 rand × 5000 (rand는 0 이상 1 미만)
backoffDelay(attempt, rand): ms        // attempt 1부터. base = [60, 120, 300, 600][min(attempt, 4) - 1]초
                                       // 결과 = min(600000, round(base × 1000 × (0.8 + 0.4 × rand)))
connectRetryDelay(n): ms               // 데이터가 한 번도 없을 때. n=1: 30000, 2: 60000, 3 이상: 300000
staleness(lastOkMs, nowMs): { level: 'ok' | 'stale' | 'days', text: string }
  // lastOkMs null → level 'ok', text ''(연결 중 화면이 따로 있음). 차이 <= 600000 → ok.
  // 600000 초과 → stale, text '마지막 갱신 ' + seoulNow(lastOkMs).time. 86400000 초과 → days, text '며칠째 갱신되지 않음'
clockSkew(updatedAt, nowMs): boolean   // Date.parse(updatedAt) - nowMs > 300000. 파싱 실패면 false
isDawnReload(nowMs, lastReloadDate): boolean  // 서울 시각 03:00 <= t < 05:00 이고 lastReloadDate !== 오늘
```

### 3-9. `ids.js`, `privacy.js`
```js
isValidFileId(s): boolean        // typeof s === 'string' && /^[A-Za-z0-9_-]{20,80}$/.test(s)
randomId(n = 12): string         // crypto.getRandomValues, 글자 [a-z0-9]
boardFileName(): 'board-' + randomId(12) + '.json'
imageFileName(): 'img-' + randomId(12) + '.jpg'
historyFileName(boardId, rev): 'classboard-hist-' + boardId + '-' + rev + '.json'
parseHistoryName(name): { boardId, rev } | null
phoneWarning(text): string[]     // 찾은 전화번호 모양 글 목록 (없으면 [])
  // /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g, /0(2|[3-6][1-5])[-.\s]\d{3,4}[-.\s]\d{4}/g. 앞뒤가 숫자면 제외
```

### 3-10. 테스트 사례 (A가 `tests/`에 그대로 넣는다)
공통: 시각은 `Date.UTC(...)`로 만든다. KST = UTC + 9. `tests/time.test.js` 첫 줄에서 `process.env.TZ = 'UTC'`로 바꾼 뒤 같은 결과가 나와야 한다 (PC 시간대 UTC 가정). 시간표 시험 데이터: class 1 09:00-09:45, 2 09:55-10:40, 3 10:50-11:35, 4 11:45-12:30, break '점심' 12:30-13:20, class 5 13:20-14:05, 6 14:15-15:00, 모든 요일 week 1~6교시 과목 있음.

| 함수 | 사례 | 입력 | 기대값 |
|---|---|---|---|
| seoulNow | 자정 직전 | `Date.UTC(2026,10,13,14,59,59)` | `{ date:'2026-11-13', time:'23:59', weekday:'fri' }` |
| seoulNow | 자정 직후 | `Date.UTC(2026,10,13,15,0,0)` | `{ date:'2026-11-14', time:'00:00', weekday:'sat' }` |
| seoulNow | TZ=UTC에서도 | 위 두 값, `process.env.TZ='UTC'` | 같음 |
| seoulIso | | `Date.UTC(2026,10,8,10,30,0)` | `'2026-11-08T19:30:00+09:00'` |
| todayTimetable | 자정 직전·직후 | 2026-11-13 23:59 KST / 11-14 00:00 KST | `status:'class'`(모든 행 past) / `status:'weekend', label:'주말'` |
| todayTimetable | 교시 경계 | 2026-11-10 09:44 / 09:45 KST | 1교시 `now` / 1교시 `past`, 2교시 `next`, `now` 없음 |
| todayTimetable | 쉬는 시간 | 09:50 | 1교시 past, 2교시 next |
| todayTimetable | 첫 교시 전 / 끝난 뒤 | 08:30 / 15:10 | 1교시 next / 모두 past, next 없음 |
| todayTimetable | 점심 | 12:40 | 점심 행 now, 5교시 next |
| todayTimetable | 공휴일 | noClass `{2026-11-17, 2026-11-17, '개교기념일'}`, 11-17 10:00 | `status:'noClass', label:'개교기념일', rows: []` |
| todayTimetable | 방학 | noClass `{2026-12-24, 2027-02-28, '겨울방학'}`, 2027-01-05 / 2027-02-28(일) / 2027-03-02 | noClass 겨울방학 / noClass 겨울방학 (주말보다 먼저) / class |
| todayTimetable | overrides 병합 | 2026-11-12, `replaceAll:false, items:[{period:3, subject:'체육', note:'강당'}, {period:5, subject:''}]` | 3교시 '체육'·'강당', 5교시 없음, 나머지 week.thu |
| todayTimetable | replaceAll | 2026-11-12, `replaceAll:true, items:[{period:1, subject:'현장체험'}]` | class 행은 1교시만 (점심 행은 남음) |
| todayTimetable | 버전 | 버전 2개 effectiveFrom 2026-09-01, 2026-11-11. 11-10 / 11-11 | 첫 버전 / 둘째 버전 |
| activeNotices | 시작일=오늘 | 오늘 2026-11-10 (`Date.UTC(2026,10,9,15,0)`), startDate 11-10 | 포함 |
| activeNotices | 시작 전 | startDate 11-11 | 빠짐 |
| activeNotices | 종료일=어제 / 오늘 | endDate 11-09 / 11-10 | 빠짐 / 포함 |
| activeNotices | 정렬 | important false order 0, important true order 5, important true order 1 | true·1, true·5, false·0 |
| pageNotices | 시간 | rotateSec 15, 글자수 200 한 개 / 80 한 개 | sec 25 / 15 |
| pageNotices | 나누기 | 글자수 300, 300, 100 | 페이지 [300,300], [100] |
| pageNotices | 큰 안내 | 640 하나 + 50 | [640], [50] |
| pageNotices | 고정 | important 3개 | pinned 앞 2개 |
| eventsView | D-n | 오늘 11-10, 일정 11-20 | 'D-10', upcoming |
| eventsView | 당일·기간 | 11-10 / 11-09~11-11 | 'D-Day' ongoing / 'D-Day' ongoing |
| eventsView | 끝남 | 11-09 / 11-01~11-09 | 숨김 / 숨김 |
| eventsView | 해 넘김 | 오늘 2026-12-31, 일정 2027-01-01 | 'D-1' |
| dutyFor | 주 단위, 나누어떨어지지 않음 | 학생 1~10, 구역 1개, perZone 3, unit week, start 2026-11-09. 11-09 / 11-16 / 11-30 / 12-07 | [1,2,3] / [4,5,6] / [10,1,2] / [3,4,5] |
| dutyFor | 시작일 이전 | 위, 2026-11-06 | `status:'before', startDate:'2026-11-09'` |
| dutyFor | 시작일이 수요일 | start 2026-11-11, 11-10 / 11-16 | before / k=1 → [4,5,6] |
| dutyFor | 일 단위 | 위 학생, unit day, start 11-09. 11-13(금) / 11-16(월) | [3,4,5] / [6,7,8] (주말 건너뜀) |
| dutyFor | 주말 | 11-14 | `status:'weekend'` |
| dutyFor | 구역 2개 | 학생 1~7, 구역 a·b, perZone 2, unit day, start 11-09, 11-10 | a [5,6], b [7,1] |
| dutyFor | 임시 교체 | 위 + swaps `[{date:'2026-11-10', zoneId:'a', from:5, to:2}]` / `to:null` / date 11-11 | a [2,6] / a [6] / a [5,6] |
| dutyFor | 고정 | mode fixed, `fixed.tue = {a:[3,4]}`, 11-10 | a [3,4] |
| dutyFor | 이름 | nameMode masked, 학생 3 name '김○○' / number | label '3번 김○○' / '3번' |
| maskName | | '김하늘' / '이' | '김○○' / '이○' |
| validateBoard | number에 이름 | nameMode number, `students:[{no:1, name:'김하늘'}]` | ok false, code 'name' |
| validateBoard | 상한 | 끝나지 않은 안내 51개 / 제목 41자 / 본문 501자 / 일정 201개 / class 13교시 / 구역 13개 / 이미지 21개 | 각각 ok false, code 'limit' |
| validateBoard | 크기 | 204801바이트 문자열 / 160000바이트 | ok false 'tooBig' / ok true + warning 'size150' |
| validateBoard | 스키마 | kind 'x' / schemaVersion 2 / minReader 2 / 미지의 필드 `foo` | 'kind' / ok, newer true / needsUpdate / ok, 결과에 foo 없음 |
| validateBoard | 교시 순서 | 2교시 start 09:40 (1교시 end 09:45) | 'order' |
| validateBoard | 이미지 연결 | notice imageId 'zzz'(없음) | 'ref' |
| validateBoard | design | palette 'pink' | ok true, palette 'honey', warning 'design.palette' |
| contrastRatio | | '#FFFFFF','#000000' / '#C98A1B','#FFFFFF' | 21 / 2.94 (소수 둘째 자리) |
| checkPalette | | PALETTES 4개 | 모두 ok |
| backoffDelay | | (1, 0.5) / (1, 0) / (2, 0.5) / (3, 0.5) / (4, 1) / (9, 0.5) | 60000 / 48000 / 120000 / 300000 / 600000 / 600000 |
| connectRetryDelay | | 1 / 2 / 3 / 7 | 30000 / 60000 / 300000 / 300000 |
| staleness | | 차이 600000 / 600001 / 86400001 | ok / stale '마지막 갱신 HH:MM' / days |
| clockSkew | | updatedAt = now + 300000 / + 300001 / 'x' | false / true / false |
| isDawnReload | | 02:59 / 03:00 / 04:59 / 05:00 (last 어제), 03:30 (last 오늘) | false / true / true / false / false |
| isValidFileId | | 19자 / 20자 / 80자 / 81자 / '../abcdefghijklmnopqrstu' / 공백 포함 / 123 | false / true / true / false / false / false / false |
| phoneWarning | | '010-1234-5678', '01012345678', '010 1234 5678', '02-123-4567' / '2026-11-08', '3학년 5반 12번', '1234-5678' | 찾음 / [] |

## 4. 색 묶음과 대비

### 4-1. 표시 화면 색 묶음 (`PALETTES`, 단위 '#RRGGBB')
뜻: `bg` 화면 바탕, `surface` 칸 바탕, `text` 글자, `muted` 약한 글자(지난 교시, 보조), `accent` 글자용 강조('다음', 진행 표시 글자), `fill` 진행 칸 채움(지금 교시 행 바탕), `onFill` 채움 위 글자, `title` 위 띠 학급 이름, `warn` 구석 경고 글자, `line` 구분선(장식).

| 묶음 | bg | surface | text | muted | accent | fill | onFill | title | warn | line |
|---|---|---|---|---|---|---|---|---|---|---|
| `honey` 꿀색(기본) | #FBEFD5 | #FFFFFF | #2E2418 | #6E604E | #8A5A0B | #C98A1B | #2E2418 | #6B4410 | #B42318 | #E8DCC6 |
| `brown` 짙은 갈색 | #6B4410 | #56360C | #FFFFFF | #FBEFD5 | #F7C97A | #C98A1B | #2E2418 | #FFFFFF | #FFB4A8 | #8A5A0B |
| `sand` 연한 모래 | #F6EEDF | #FDF8EE | #2E2418 | #6E604E | #7A4F0A | #C98A1B | #2E2418 | #6B4410 | #B42318 | #E8DCC6 |
| `night` 짙은 바탕 | #1B150E | #2E2418 | #FBEFD5 | #CDBFA8 | #E9B04A | #C98A1B | #1B150E | #FBEFD5 | #FF9A8C | #4A3D2C |

### 4-2. 대비 계산 (WCAG 상대 휘도, 직접 계산. 모두 4.5:1 이상)
| 묶음 | text/bg | text/surface | muted/bg | muted/surface | accent/bg | accent/surface | title/bg | title/surface | warn/bg | warn/surface | onFill/fill |
|---|---|---|---|---|---|---|---|---|---|---|---|
| honey | 13.32 | 15.20 | 5.34 | 6.09 | 5.19 | 5.92 | 7.48 | 8.54 | 5.76 | 6.57 | 5.16 |
| brown | 8.54 | 10.89 | 7.48 | 9.55 | 5.53 | 7.05 | 8.54 | 10.89 | 5.02 | 6.40 | 5.16 |
| sand | 13.18 | 14.36 | 5.29 | 5.76 | 6.17 | 6.72 | 7.41 | 8.07 | 5.70 | 6.21 | 5.16 |
| night | 15.87 | 13.32 | 10.01 | 8.41 | 9.29 | 7.80 | 15.87 | 13.32 | 8.84 | 7.42 | 6.15 |

참고(기본 토큰): 진행 #C98A1B은 흰 바탕 2.94, #FBEFD5 위 2.58로 **글자에 쓰지 않는다**. 채움(`fill`) 전용이고 그 위 글자는 #2E2418(5.16). 글자용 강조는 #8A5A0B(흰 바탕 5.92). `line`은 장식용(1.2~1.8)이라 정보 전달에 쓰지 않는다.

사용 규칙:
- 글자는 언제나 불투명한 `surface` 또는 `bg` 위에 놓는다. 배경 이미지는 칸 사이와 가장자리에만 보이고 그 위에 글자를 두지 않는다 (위 띠도 `surface`). 그래서 `overlay`는 대비 검사와 상관없다.
- '흐리게'(지난 교시, 교시 사이의 직전 교시)는 `muted` 색으로 한다. `opacity`로 흐리게 하지 않는다 (대비가 떨어짐).
- 지금 교시: 행 바탕 `fill`, 글자 `onFill`, 굵기 600. '다음' 표시: `accent` 글자.
- `render.js`가 `PALETTES[design.palette]`를 루트 요소의 CSS 변수(`--b-bg`, `--b-surface`, `--b-text`, `--b-muted`, `--b-accent`, `--b-fill`, `--b-on-fill`, `--b-title`, `--b-warn`, `--b-line`)로 넣는다. CSS에 색값을 따로 적지 않는다.

### 4-3. 입력 화면 색 (기존 앱 토큰, `css/admin.css`)
주 #6B4410(흰 바탕 8.54), 진행 #C98A1B(채움 전용), 연한 배경 #FBEFD5, 글자 #2E2418(15.20), 약한 글자 #6E604E(6.09), 선 #E8DCC6, 오류 #B42318(흰 6.57, 연한 배경 5.76), 통과 #5B7A2E(흰 4.92, **연한 배경 위 4.31이라 글자 불가**) → 통과 글자는 #4A6326(흰 6.8, 연한 배경 6.0). 주의 글자 #8A5A0B. 버튼 44px 이상, 포커스 링 3px #6B4410, 알림 `aria-live="polite"`.

## 5. 드라이브 계약

### 5-1. 주소와 범위 (`drive-common.js`)
```js
export const API = 'https://www.googleapis.com/drive/v3/files';
export const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export const DOWNLOAD = 'https://www.googleapis.com/download/drive/v3/files';
export const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata';
// drive.appdata는 이력(appDataFolder)에 필요. 2026-11-08 사용자 결정으로 두 권한 모두 쓴다.
metaUrl(fileId, key = ''): `${API}/${enc(id)}?fields=version,modifiedTime` + (key ? `&key=${enc(key)}` : '')
mediaUrl(fileId, key = ''): `${DOWNLOAD}/${enc(id)}?alt=media` + (key ? `&key=${enc(key)}` : '')
// 둘 다 isValidFileId 실패면 throw new DriveError('invalid'). 본문·이미지는 반드시 DOWNLOAD 주소 (스파이크: /drive/v3/...?alt=media는 CORS 없는 차단 페이지)
```
모든 fetch는 `cache: 'no-store'`. `referrerPolicy`를 바꾸지 않는다 (키 참조 제한은 Referer/Origin으로 통과, `no-referrer`면 `<img>`가 막힘). If-Match는 쓰지 않는다 (무시됨, ETag도 안 보임).

### 5-2. 엔드포인트 (입력 화면은 `Authorization: Bearer <토큰>`, 표시 화면은 `&key=`)

| 동작 | 요청 | 성공 응답 |
|---|---|---|
| 게시판 목록 | `GET ${API}?q=${enc("appProperties has { key='classboard' and value='board' } and trashed=false")}&fields=${enc('files(id,name,version,modifiedTime)')}&orderBy=${enc('modifiedTime desc')}&pageSize=50` | `{ files: [...] }` (drive.file이라 이 앱이 만든 파일만). 제목은 각 파일 본문을 받아 `title`로 |
| 게시판 만들기 | `POST ${UPLOAD}?uploadType=multipart&fields=id,name,version,modifiedTime`, `Content-Type: multipart/related; boundary=cb<무작위>`. 1부: `application/json; charset=UTF-8` 메타 `{ name: boardFileName(), mimeType: 'application/json', appProperties: { classboard: 'board' } }` (parents 없음 = 내 드라이브). 2부: `application/json; charset=UTF-8` 본문 | `{ id, name, version, modifiedTime }` |
| 이미지 올리기 | 같은 multipart. 메타 `{ name: imageFileName(), mimeType: 'image/jpeg', appProperties: { classboard: 'image', board: <게시판 파일 ID> } }`, 2부 `Content-Type: image/jpeg` + 바이너리. 몸통은 `new Blob([머리글, jpegBlob, '\r\n--' + boundary + '--'])` | 같음 |
| 본문 수정 | `PATCH ${UPLOAD}/${enc(id)}?uploadType=media&fields=version,modifiedTime`, `Content-Type: application/json; charset=UTF-8`, 몸통 JSON 문자열 | `{ version, modifiedTime }` |
| 메타 확인 | `GET metaUrl(id[, key])` | `{ version: '숫자 문자열', modifiedTime }`. version은 문자열 그대로 같음 비교 |
| 본문·이미지 받기 | `GET mediaUrl(id[, key])` | 본문: 텍스트(`res.text()` 후 `validateBoard`), 이미지: `res.blob()` |
| 공유 만들기 | `POST ${API}/${enc(id)}/permissions?fields=id,type,role,allowFileDiscovery`, 몸통 `{ type: 'anyone', role: 'reader', allowFileDiscovery: false }` | 200 `{ id: 'anyoneWithLink', ... }` |
| 공유 확인 | `GET ${API}/${enc(id)}/permissions?fields=${enc('permissions(id,type,role,allowFileDiscovery)')}` | 공유 중 = `type==='anyone' && role==='reader' && allowFileDiscovery===false`인 항목이 있음. `anyone`인데 그 밖의 값이면 지우고 다시 만든다 |
| 공유 끊기 | `DELETE ${API}/${enc(id)}/permissions/${enc(permId)}` (permId는 확인 결과의 id) | 204 |
| 파일 삭제 | `DELETE ${API}/${enc(id)}` (영구 삭제. `trashed:true` 수정 금지) | 204 |
| 고아 이미지 찾기 | `GET ${API}?q=${enc("appProperties has { key='board' and value='<게시판ID>' } and trashed=false")}&fields=${enc('files(id,modifiedTime)')}&pageSize=100` | |
| 이력 쓰기 | `POST ${UPLOAD}?uploadType=multipart&fields=id,name`, 메타 `{ name: historyFileName(boardId, rev), parents: ['appDataFolder'], mimeType: 'application/json' }` | 공유하지 않는다 (appDataFolder는 공유 불가) |
| 이력 목록 | `GET ${API}?spaces=appDataFolder&q=${enc("name contains 'classboard-hist-<boardId>-' and trashed=false")}&fields=${enc('files(id,name,modifiedTime)')}&pageSize=100` | `parseHistoryName`으로 rev 내림차순 |
| 이력 읽기 | `GET ${DOWNLOAD}/${enc(histId)}?alt=media` | 텍스트 |

appDataFolder는 같은 OAuth 클라이언트를 쓰는 다른 앱(생기부 v2 `sgb-*`, 출결 앱)과 공유된다. 게시판은 이름이 `classboard-hist-`로 시작하는 파일만 만들고 지운다.

### 5-3. 오류 분류 (`classifyDriveError({ status, body, op })`, `DriveError(kind, { status })`)
`body`는 응답 JSON(`{ error: { code, errors: [{ reason }] } }`) 또는 null. `op`: `'read' | 'write' | 'share' | 'delete' | 'list'`. 토큰·키·응답 본문은 오류 문구와 콘솔에 넣지 않는다.

| kind | 조건 (위에서부터 먼저 맞는 것) | 입력 화면 문구 (`ADMIN_MESSAGES`) | 표시 화면 |
|---|---|---|---|
| `network` | fetch 예외, 시간 초과(30초 `AbortController`), JSON 아닌 응답 | '인터넷 연결을 확인하세요. 저장되지 않았습니다' (읽기면 '인터넷 연결을 확인하세요') | 백오프, 마지막 내용 유지 |
| `rateLimit` | 403 + reason `rateLimitExceeded`/`userRateLimitExceeded`/`downloadQuotaExceeded`, 429, 5xx | '구글 드라이브가 잠시 바쁩니다. 1분 뒤 다시 해 주세요' | 백오프, 마지막 내용 유지 |
| `auth` | 401 | '구글 로그인이 만료되었습니다. 다시 로그인하세요' + [다시 로그인] | (해당 없음) |
| `shareBlocked` | `op:'share'`이고 403 또는 400 | '이 계정은 링크 공유가 허용되지 않습니다. 개인 구글 계정으로 로그인하세요' (기획서 원문) | |
| `forbidden` | 그 밖 403 | '이 파일에 접근할 권한이 없습니다. 게시판을 만든 계정으로 로그인했는지 확인하세요' | 백오프 + 구석 '연결 설정을 확인하세요' |
| `notFound` | 404 | '드라이브에서 게시판 파일을 찾지 못했습니다. 삭제되었거나 공유가 끊겼을 수 있습니다' | 연속 2번이면 '주소 오류' (9절) |
| `invalid` | 그 밖 4xx, 파일 ID 형식 불량, `validateBoard` 실패 | '게시판 파일 내용이 올바르지 않습니다' | 마지막 내용 유지 + 구석 문구 (2-9) |

로그인 문구 (GIS, `DriveError` 아님): 관리자 정책·`access_denied` → '이 구글 계정으로는 로그인할 수 없습니다. 학교 계정은 외부 앱이 막혀 있을 수 있으니 개인 구글 계정으로 로그인하세요', 팝업 실패 → '구글 로그인 창을 열지 못했습니다. 팝업 차단을 확인하세요', `hasGrantedAllScopes` 실패 → '권한 상자를 모두 체크해야 합니다. 다시 로그인하세요'. 토큰은 메모리 + `sessionStorage['classboard:admin:token']` (`{ accessToken, expiresAt }`), 만료 1분 전부터 무효.

### 5-4. AdminDrive (입력 화면이 쓰는 모양. `js/admin/drive.js`와 `createFakeDrive()`가 똑같이 구현)
```js
signIn({ consent = false }): Promise<void>      hasToken(): boolean      signOut(): Promise<void>
listBoards(): Promise<[{ id, name, version, modifiedTime }]>
createBoard(board): Promise<{ id, version, modifiedTime }>   // 5-7 절차 전부. 끝나면 공유 확인된 상태
getMeta(id): Promise<{ version, modifiedTime }>
readText(id): Promise<string>                                 // 본문 또는 이력
saveBoard(id, text): Promise<{ version, modifiedTime }>       // PATCH media
uploadImage(boardId, jpegBlob): Promise<{ id }>               // 만들기 + 공유 + 확인
readImage(id): Promise<Blob>
shareState(id): Promise<'shared' | 'stopped'>
share(id): Promise<void>       unshare(id): Promise<void>      deleteFile(id): Promise<void>
listImages(boardId): Promise<[{ id, modifiedTime }]>          // 고아 이미지 정리용
listHistory(boardId): Promise<[{ id, rev, modifiedTime }]>    // rev 내림차순
writeHistory(boardId, rev, text): Promise<void>               // 쓴 뒤 6번째부터 지움 (5개 유지)
```

### 5-5. DisplaySource (표시 화면이 쓰는 모양. `createKeySource({ apiKey })`와 가짜 드라이브의 `asSource()`)
```js
getMeta(fileId): Promise<{ version, modifiedTime }>
getText(fileId): Promise<string>
getImage(fileId): Promise<Blob>
// 실패는 DriveError (5-3). 구글 로그인 쿠키를 보내지 않는다 (credentials 기본값 그대로).
```

### 5-6. 저장 절차 ([저장])
1. 편집본을 `validateBoard`로 검사. 오류면 해당 칸에 표시하고 멈춤. `phoneWarning`이 찾으면 '전화번호로 보이는 글이 있습니다: <찾은 글>. 그래도 저장할까요?' 확인. 200KB 초과면 '200KB를 넘어 저장할 수 없습니다'.
2. `getMeta(id)`의 version을 `baseVersion`(마지막으로 불러오거나 저장한 version)과 비교.
3. 다르면 멈추고 '다른 곳에서 이 게시판을 먼저 저장했습니다.' 대화상자 (서버 본문을 `readText`로 받아 둔다):
   - [서버 내용 불러오기]: 내 변경을 버리고 서버 내용으로 편집 화면을 바꿈 (`baseVersion` = 서버 version)
   - [내 내용으로 덮어쓰기]: 4로 진행 (rev는 서버 본문의 rev 기준)
   - [차이 보기]: `diffBoards(내 것, 서버 것)` → `[{ section, added: [제목], removed: [제목], changed: [제목] }]` 목록을 보여 주고 위 두 버튼으로 돌아감
4. `rev = 서버 본문 rev + 1`, `updatedAt = seoulIso(Date.now())`, `saveBoard(id, JSON.stringify(board))`.
5. 성공: `baseVersion` 갱신, 직전 서버 본문(`rev` 그대로)을 `writeHistory`. 이력 실패는 저장을 되돌리지 않고 '이전 버전 보관에 실패했습니다'만 알림. 지워진 이미지 `deleteFile` (2-7). 알림 '저장했습니다. 학급 PC에는 1분 안에 반영됩니다'.
6. 저장 버튼 옆 상시 문구: '다른 PC에서 동시에 고치면 마지막에 저장한 내용이 남습니다'.
- [이전으로 되돌리기]: `listHistory` 목록(시각, rev) → 고르면 `readText` → 편집 화면에 불러옴(저장 안 한 변경 상태). 그 안의 이미지 중 `getMeta`가 404인 것은 빼고 '삭제된 이미지 n개는 되돌릴 수 없습니다'. 저장은 위 절차 그대로 (rev는 계속 증가).
- 열 때 `schemaVersion > 1`이면 저장을 막는다 (2-9). 저장 안 한 변경이 있으면 `beforeunload` 경고.
- 게시판을 열 때 `listImages(boardId)` 중 `images[].fileId`에 없고 `modifiedTime`이 24시간 넘은 파일을 `deleteFile` (저장하지 않고 닫아 남은 이미지 정리).

### 5-7. 공유 만들기 완료 조건 ([새 게시판 만들기], 이미지 올리기도 같음)
1. 파일 만들기 (본문 = `defaultBoard(title, Date.now())`).
2. `permissions.create` anyone/reader/allowFileDiscovery false.
3. `permissions.list`로 확인. 안 보이면 2초 뒤 한 번 더.
4. 3까지 성공해야 '만들기 완료'. 2가 `shareBlocked`이거나 3이 끝내 확인 안 되면 만든 파일을 `files.delete`하고 해당 문구 표시 (확인 실패: '공유를 확인하지 못했습니다. 다시 만들어 주세요').
- 공유 상태는 입력 화면 머리에 늘 '공유 중' 또는 '공유 중지됨'. [지금 공유 끊기]는 본 파일과 모든 이미지의 공유를 지운다 (확인 대화상자 '학급 PC 화면에 더 이상 보이지 않습니다. 끊을까요?'). [다시 공유하기]는 모두 다시 만든다.

### 5-8. 삭제 절차 ([게시판 삭제])
확인 대화상자 원문: '게시판, 이미지 n개, 이전 버전 m개가 모두 영구 삭제됩니다. 되돌릴 수 없습니다.' + 학급 이름을 그대로 입력해야 [영구 삭제] 버튼이 켜짐. 순서: 이미지 전부 → 이력 전부 → 본 파일 (`files.delete`만, 휴지통 이동 금지). 중간에 실패하면 멈추고 '일부만 삭제되었습니다. 다시 누르면 나머지를 지웁니다' (본 파일이 마지막이라 다시 찾을 수 있음). 끝나면 이 PC의 `classboard:*:<파일ID>` 키도 지운다.

## 6. 가짜 드라이브 모드
- 켜짐: `isFakeMode({ hostname, search })` = (hostname이 `localhost`, `127.0.0.1`, `[::1]`이거나 `.localhost`로 끝나고 `dev` 값이 `'0'`이 아님) 또는 `?dev=1`. 표시·입력 화면 모두 같은 함수. 켜지면 구글로 아무것도 보내지 않고 두 화면 구석에 '가짜 드라이브 모드'.
- `createFakeDrive({ store, now = () => Date.now() })`: AdminDrive 전부 + `asSource()`(DisplaySource) + 시험 도구 `setOffline(bool)`, `failNext(kind, count = 1)`, `blockShare(bool)`(공유 만들기가 `shareBlocked`), `files()`, `calls`.
- `store`: `{ getText(key), setText(key, v), removeText(key), getBlob(key), setBlob(key, blob), removeBlob(key) }` (모두 Promise). node 테스트는 `Map` 기반 메모리, 브라우저는 `js/fake-store.js`.
- 브라우저 저장 위치: 목록 `localStorage['classboard:fake:index']` = `{ files: { [id]: { name, mimeType, appProperties, version, modifiedTime, parents, perms: [] } } }`, 본문 `localStorage['classboard:fake:text:<id>']`, 이미지 Cache Storage `classboard:fake:img`의 `./__fake/<id>`.
- 파일 ID: `'fake' + randomId(24)` (28자, `isValidFileId` 통과). 쓰기마다 version을 1 올리고 `modifiedTime`을 `now()`로. 공유가 없으면 `asSource()`의 읽기는 `notFound` (진짜와 같게).
- 같은 출처(같은 포트)의 index.html과 admin.html이 같은 localStorage를 보므로, `localhost`에서 키 없이 입력 화면에서 만들고 저장 → [표시 화면 미리보기](`index.html?f=<가짜 ID>`)에서 1분 안에 바뀌는 것을 확인한다. 표시 화면은 가짜 모드에서 `storage` 이벤트가 오면 바로 확인한다.
- 가짜 모드의 로그인은 버튼만 누르면 됨 (토큰 없음).

## 7. 저장 키 목록 (같은 출처의 다른 앱과 섞이지 않게 모두 `classboard:`)
| 저장소 | 키 / 이름 | 값 | 쓰는 쪽 |
|---|---|---|---|
| localStorage | `classboard:board:<파일ID>` | `{ text, version, modifiedTime }` 마지막 정상 본문 | 표시 |
| localStorage | `classboard:ok:<파일ID>` | 마지막 성공 확인 시각(ms 문자열) | 표시 |
| localStorage | `classboard:reload:<파일ID>` | 마지막 새벽 재로드 날짜 'YYYY-MM-DD' | 표시 |
| Cache Storage | `classboard:img:<파일ID>` | 요청 키 `./__img/<이미지 파일ID>` → 이미지 응답 (주소에 키를 넣지 않는다) | 표시 |
| Cache Storage | `classboard:shell:<VERSION>` | 앱 파일 | sw.js |
| sessionStorage | `classboard:admin:token` | `{ accessToken, expiresAt }` | 입력 |
| localStorage | `classboard:fake:index`, `classboard:fake:text:<id>` | 6절 | 가짜 |
| Cache Storage | `classboard:fake:img` | 6절 | 가짜 |
IndexedDB는 쓰지 않는다. 학생 이름 대응표(number 모드)는 어디에도 저장하지 않는다 (메모리만).

## 8. 서비스 워커 (`sw.js`, 범위 `/class-board/`)
- `const VERSION = 'YYYYMMDD-n';` `SHELL` 배열: `./`, `./index.html`, `./config.js`, `./css/tokens.css`, `./css/board.css`, 표시 화면이 import하는 `js/display/*.js`, `js/core/*.js` 전부, `./fonts/*.woff2` 3개. `tests/sw-shell.test.js`가 빠진 파일이 없는지 검사.
- **SHELL 파일이나 `config.js`(키 교체 포함)를 바꾸는 커밋은 반드시 VERSION을 올린다.** 검수 항목.
- install: `caches.open('classboard:shell:' + VERSION)`에 `SHELL`을 `new Request(u, { cache: 'reload' })`로 넣고 `skipWaiting()`. activate: 이름이 `classboard:shell:`로 시작하고 현재가 아닌 캐시만 지우고 `clients.claim()`. 다른 앱 캐시는 건드리지 않는다.
- fetch: 같은 출처 GET이고 SHELL에 있는 것만 캐시 우선. 이동 요청 `/class-board/` 또는 `index.html`(검색어 무시, `ignoreSearch: true`)은 캐시의 `index.html`. 그 밖(admin.html, sw.js, googleapis)은 손대지 않는다.
- 새 배포 24시간 안 반영: 표시 화면이 시작할 때와 6시간마다 `registration.update()`, 그리고 새벽 재로드. 새 워커가 `controllerchange`를 일으키면(처음 설치가 아닐 때) 바로 `location.reload()`.

## 9. 표시 화면 동작 규칙 (`js/display/main.js`)
| 항목 | 규칙 |
|---|---|
| 시작 | `f` 검사 실패 → '주소 오류' 화면, 요청 없음. 가짜 모드 아니고 `DRIVE_API_KEY === ''` → '설정이 필요합니다. config.js에 DRIVE_API_KEY를 넣어 주세요'. 캐시 본문이 있으면 바로 그림 |
| 첫 확인 | `startDelay(캐시 있음, Math.random())` 뒤 |
| 주기 | 성공하면 60초 뒤 다시 (`setTimeout` 연쇄, 매번 다시 예약). `getMeta` → version이 캐시와 다를 때만 `getText` → `validateBoard` |
| 가려진 탭 | 스파이크: 가려진 탭은 타이머가 1분 단위로 늦춰짐. 워커 타이머는 쓰지 않고, `visibilitychange`로 보이게 될 때 마지막 확인이 60초 넘었으면 바로 확인 |
| 실패 | `rateLimit`·`network`·`forbidden`: 실패 횟수 n → `backoffDelay(n, Math.random())`. 성공하면 n = 0. 캐시가 한 번도 없으면 대신 `connectRetryDelay(n)` |
| 연결 중 | 캐시와 데이터가 모두 없으면 가운데 '연결 중' + 작은 글 '잠시 뒤 다시 시도합니다'. 30초, 60초, 그 뒤 5분 간격 |
| 주소 오류 | 파일 ID 형식 불량, 또는 `notFound` 연속 2번. 가운데 '주소 오류' + '학급 PC 연결 주소를 다시 확인하세요'. 404일 때는 그 파일 ID의 7절 키와 이미지 캐시를 지운다 (공유를 끊거나 삭제한 내용이 남지 않게). 이후 5분마다 다시 확인 |
| 경고 문구 (오른쪽 아래 구석, `warn` 색, 화면을 가리는 창 없음) | `staleness(ok 시각, now)`: '마지막 갱신 14:05' / '며칠째 갱신되지 않음'. `clockSkew(board.updatedAt, now)`: '이 PC의 시계를 확인하세요'. needsUpdate: '화면 업데이트 필요' (동시에 `registration.update()`). 검사 실패: '내용을 읽지 못해 이전 내용을 표시합니다'. forbidden: '연결 설정을 확인하세요'. 여러 개면 한 줄씩 |
| 다시 계산 | 매초 시계 글자만, 분이 바뀔 때 시간표·안내·일정·당번을 캐시 원본에서 새로 계산 |
| 안내 넘기기 | `pageNotices`의 `sec`마다 다음 페이지, 끝나면 처음 |
| 새벽 재로드 | 분마다 `isDawnReload(now, classboard:reload 값)`이 참이면 `fetch('./sw.js?ping=' + now, { cache: 'no-store' })`가 200일 때만 날짜를 적고 `location.reload()` |
| 커서 | 3초 동안 `mousemove` 없으면 `cursor: none`, 움직이면 다시 보임 |
| Wake Lock | 시작 때 `navigator.wakeLock?.request('screen')`, `visibilitychange`로 보이면 다시 요청. 없거나 거부돼도 조용히 넘어감 |
| 이미지 | 본문 성공 뒤 필요한 이미지가 캐시에 없으면 `getImage` → `cache.put('./__img/<id>', new Response(blob))`, 표시는 캐시 blob의 objectURL. 받지 못하면 그 자리에 대체 글. `images`에 없는 캐시 항목은 지움 |

## 10. 화면 구성 요약

### 10-1. 표시 화면 (`index.html?f=파일ID`, 기획서 11절)
- 16:9 전체화면. 크기 기준 `--u: min(1vw, 1.778vh)`, 본문 `calc(1.46 * var(--u) * fontScale)` (1920px에서 28px), 학급 이름·시각 `2.6u`, 구석 문구 `0.9u`. 숫자 `font-variant-numeric: tabular-nums`.
- 위 띠: 학급 이름(`title` 색) / 날짜와 요일('11월 8일 일요일') / 현재 시각 'HH:MM' (`showClock`). 고정 안내 제목 최대 2개는 위 띠 바로 아래 한 줄.
- 시간표 칸: `layout.timetable` 쪽 세로 열 (너비 약 26%). 행 '1교시 국어', 점심 등 break 행은 작게. `noClass`·주말은 라벨만 크게.
- 나머지 영역: `layout.order` 순서로 세로로 쌓되, `events`와 `duty`가 이웃이면 한 줄에 나란히 (6:4). `notices`는 남는 높이를 모두 씀. 꺼진 칸(`blocks`)은 빠지고 나머지가 채움.
- 안내: 제목(600), 본문(`richLines`), 이미지(있으면 그 페이지에 하나, `object-fit: contain`, alt 적용). 페이지 표시 '2 / 5'.
- 일정: `eventsView` 최대 5개 + '외 n건', 'D-3 현장체험학습 11월 20일'.
- 청소당번: 구역별 카드 '교실 청소: 3번, 7번, 12번'. before: '청소당번은 11월 9일부터'. 주말·none이면 칸 숨김.
- 배경: `background.kind:'image'`면 화면 전체에 이미지 + `bg`색 `overlay` 덮개. 칸은 `surface` 불투명.
- 각 칸 요소에 `data-block="timetable|notices|events|duty"`. 최악 데이터(16절 10번)에서 글자가 잘리지 않음 (넘치면 페이지·'외 n건'으로).

### 10-2. 입력 화면 (`admin.html`, 기획서 9절)
- 머리(항상): 상시 안내 원문 **'이름·연락처 같은 개인정보는 쓰지 마세요. 링크를 아는 사람은 누구나 볼 수 있습니다.'** / 공유 상태 '공유 중'·'공유 중지됨' / [지금 공유 끊기](가장 눈에 띄는 버튼, 위험 색) / [저장] / 게시판 고르기.
- 첫 화면: [구글 로그인] → 게시판 목록 또는 [새 게시판 만들기](학급 이름 입력, 5-7).
- 탭 (키보드로 이동, `role="tablist"`): 안내 / 시간표 / 일정 / 청소당번 / 이미지 / 디자인 / 학급 PC 연결.
  - 안내: 제목, 내용, 시작일·종료일(빈칸 = 상시), 중요, 이미지 붙이기, [위로]·[아래로](`order` 다시 매김), [복제], 지난 안내 접기, 90일 지난 안내 '끝난 지 90일이 지난 안내가 n개 있습니다. 지울까요?'
  - 시간표: 요일×교시 표, 교시 시간표(class/break, 시각 검사 2-3), 특정 날짜 변경(overrides, 교시별 또는 [하루 전체 바꾸기]), 방학·휴업일(noClass)
  - 일정: 날짜, 끝 날짜, 시각, 제목, 메모
  - 청소당번: 구역, 학생 번호(1~n 한 번에 만들기), 순환/고정, 시작일, 단위, 구역당 인원, 오늘 교체 [이 번호 빼기]·[바꾸기], 이름 표시 방식. `full`로 바꿀 때 '링크가 새면 학생 이름이 공개됩니다' 확인 대화상자. `masked`일 때 '같은 성을 가진 학생이 여러 명이면 구별되지 않을 수 있습니다'. `number`일 때 이름 칸은 '이 PC 화면에서만 보이고 저장되지 않습니다'
  - 이미지: 고르기(JPEG/PNG/WebP) 전에 '학생 얼굴이 나온 사진은 올리지 마세요', canvas로 `fitSize` 후 JPEG 품질 0.85부터 0.05씩 낮춰 500KB 이하(0.5까지, 그래도 크면 긴 변을 0.8배씩), 대체 글 입력, 목록(쓰는 곳 표시), 삭제. 20개 상한
  - 디자인(기획서 10절): 색 묶음 4개(각 미리보기 견본과 대비 검사 결과), 글자 크기 0.8~1.4(0.1 단위), 시간표 위치 왼쪽/오른쪽, 칸 켜기·끄기 4개, 칸 순서 [위로]·[아래로], 배경 단색/이미지 + 덮개 0.5~1.0, 안내 전환 시간 5~120초, 시계 표시, [기본값으로 되돌리기](`DEFAULT_DESIGN`). 글꼴 선택 없음
  - 학급 PC 연결: 표시 주소와 [주소 복사], 명령줄과 [복사], 키오스크 체크(학생 손이 닿는 PC), [설치 파일 받기]·[제거 파일 받기], 수동 설치 순서, [표시 화면 미리보기](새 창), 공유 상태와 [지금 공유 끊기], [이전으로 되돌리기], [게시판 삭제]
- 오른쪽: `renderBoard`로 그린 16:9 미리보기 (저장 전 편집본, `transform: scale`).
- 저장 성공·실패와 확인 결과는 `aria-live` 영역에 문구.

## 11. 설치 (`js/core/install.js`, 기획서 12절)
```js
displayUrl(base, fileId): string   // base = 입력 화면 주소의 폴더 (`new URL('./', location.href).href`), 결과 `${base}?f=${fileId}`. isValidFileId 실패면 throw
commandLine({ browserPath, url, kiosk = false }): string
installBat({ url, kiosk = false }): string     // CRLF 줄바꿈, BOM 없음
uninstallBat(): string
```
- 명령줄 원문 (기본 크롬 경로를 채워 보여 주고, 다르면 고치라고 안내):
  `"C:\Program Files\Google\Chrome\Application\chrome.exe" --app=<표시주소> --start-fullscreen --user-data-dir=%LOCALAPPDATA%\ClassBoard --hide-crash-restore-bubble`
  - 키오스크면 `--start-fullscreen` 대신 `--kiosk`. 엣지: `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"` + 같은 옵션 (엣지 동작은 검수에서 확인).
  - 복원 말풍선이 계속 나오면 `--hide-crash-restore-bubble`을 `--disable-session-crashed-bubble`로 바꿔 시험 (안내서).
  - 바로가기 인수 안의 `%LOCALAPPDATA%`가 펼쳐지는지는 설치 검수(16절 3번)에서 확인. 안 되면 안내서에 `C:\Users\<이름>\AppData\Local\ClassBoard`로 쓰는 방법을 적는다.
- 수동 순서(화면 원문): '1. Win+R을 누르고 shell:startup 을 입력합니다. 2. 열린 폴더 빈 곳에서 오른쪽 클릭 > 새로 만들기 > 바로 가기. 3. 항목 위치에 위 명령줄을 붙여 넣고 이름을 ClassBoard 로 합니다. 4. PC를 다시 켜서 게시판이 열리는지 봅니다. 끄려면 Alt+F4.' 수동 설치에는 시작 지연이 없다 (바로가기 대상 260자 제한). 표시 화면이 '연결 중'과 재시도로 네트워크가 늦게 붙는 경우를 처리한다.
- 파일 이름: `ClassBoard-install.bat`, `ClassBoard-uninstall.bat` (영문. 기획서의 '설치.bat'은 영문 규칙에 맞춰 바꿈). Blob(`application/octet-stream`)으로 내려받기.
- `installBat` 내용 규칙 (차례대로):
  1. `@echo off`, `setlocal`, (앞부분은 영문만. 한국어 Windows 10에서 2번째 줄의 `chcp 65001` 뒤에 한글이 있으면 bat 전체가 깨져, 한글 문구는 끝 구역에 모으고 그 바로 앞에서만 `chcp 65001`) `set "URL=<표시주소>"` (URL은 `displayUrl` 결과만. `%`, `&`, `"`, `^`가 있으면 throw).
  2. 브라우저 찾기, 먼저 찾은 것: `reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve` → 같은 키 HKCU → `%ProgramFiles%\Google\Chrome\Application\chrome.exe` → `%ProgramFiles(x86)%\...` → `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe` → 엣지 App Paths `msedge.exe` → `%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe` → `%ProgramFiles%\...`. reg 결과는 `for /f "tokens=2,*" %%A in ('reg query ... /ve 2^>nul ^| find "REG_SZ"') do set "BROWSER=%%B"`. `(x86)`이 든 경로는 괄호 블록 안에 두지 않는다 (한 줄 `if not defined BROWSER if exist "..." set "BROWSER=..."`).
  3. 없으면 `echo 크롬과 엣지를 찾지 못했습니다. 수동 설치 방법을 따르세요.`, `pause`, `exit /b 1`.
  4. 시작 지연 실행 파일 `%LOCALAPPDATA%\ClassBoardLauncher\start.cmd` 쓰기: `@echo off` / `timeout /t 25 /nobreak >nul` / `start "" "<BROWSER>" --app=<URL> --start-fullscreen(또는 --kiosk) --user-data-dir="<LOCALAPPDATA 펼친 값>\ClassBoard" --hide-crash-restore-bubble`.
  5. PowerShell 한 번으로 바로가기 2개: 시작프로그램 `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ClassBoard.lnk`(대상 start.cmd, `WindowStyle = 7` 최소화), 바탕화면 `[Environment]::GetFolderPath('Desktop')\ClassBoard.lnk`(대상 브라우저, 인수 위와 같음, 지연 없음). `powershell -NoProfile -Command "..."`에서 값은 bat의 `set` 변수를 `$env:`로 읽는다 (따옴표 섞임 방지).
  6. 확인: 두 `.lnk`가 있으면 `echo 설치했습니다. PC를 다시 켜면 게시판이 열립니다. 끄려면 Alt+F4.`, 없으면 `echo 바로가기를 만들지 못했습니다 (PowerShell이 막혀 있을 수 있습니다). 수동 설치 방법을 따르세요.` + `exit /b 1`. 끝에 `pause`.
- `uninstallBat`: (한글 문구 직전에만 `chcp 65001`), 시작프로그램·바탕화면 `ClassBoard.lnk`와 `%LOCALAPPDATA%\ClassBoardLauncher` 삭제, `choice /c YN /m "학급 PC 화면이 보관한 내용(%LOCALAPPDATA%\ClassBoard)도 지울까요? 게시판 창을 먼저 닫으세요"` → Y면 `rmdir /s /q`. 결과 문구, `pause`.
- 테스트(B): CRLF만 있음, `chcp 65001` 있음, URL이 그대로 들어감, 잘못된 파일 ID면 throw, kiosk 옵션 바뀜.
- 안내서 `docs/설치-운영-안내서.md`: 위 수동 순서, bat 사용법, Alt+F4, 키오스크 주의, 전원 옵션(화면 끄기·절전 안 함), '설정 > 시간 및 언어 > 지금 동기화', 자동 로그인, 초기화 프로그램 예외(`%LOCALAPPDATA%\ClassBoard`, 바로가기), 전근 시 파일 소유자 이전 한 문단, 구글 클라우드 설정(기획서 14절).

## 12. 검수 보조 (기획서 16절과 연결)
- 6번 검색 범위는 `spike/`를 뺀 저장소 전체. '`board/` 밖 변경 0개'는 '`spike/` 변경 0개, 다른 저장소 변경 0개'로 읽는다.
- 8번: `f`에 `../x`, 19자, 공백, `<script>`를 넣고 네트워크 탭에 googleapis 요청이 없음을 확인.
- 7번: 공유 끊기 후 표시 화면이 404 두 번 뒤 '주소 오류'로 바뀌고 캐시를 지우는지도 본다.
