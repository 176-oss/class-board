# 검수 결과 (기획서 16절)

**요약: 통과 6, 부분 통과 1, 실패 0, 미확인 6** (16절 13개 기준. 절대 규칙 12개는 실패 없음, 아래 표)

- 검수: 검수 담당 (코드를 쓰지 않음), 2026-11-09, 브랜치 `feat/board` (작업 트리 깨끗함, 커밋 `8470e23`까지). 코드는 고치지 않았다.
- 기준: `docs/기획서.md` v0.2, `docs/contract.md`, `docs/spike.md`, 사용자 절대 규칙 12개. 기획서의 `board/`는 저장소 루트로 읽었다.
- 직접 확인: Node v26.13.0 테스트, 검색 명령, 내장 브라우저(Chromium 152)에서 `python -m http.server 8810`으로 띄운 가짜 드라이브 모드. 끝난 뒤 서버를 껐고, `classboard:` localStorage·sessionStorage·Cache 키를 모두 지웠다(남은 키 0, 서비스 워커 등록 0).
- 한계: 내장 브라우저에서는 서비스 워커 등록이 `An unknown error occurred when fetching the script`로 실패했다(`fetch('./sw.js')`는 200 `text/javascript`로 받아짐). 내장 브라우저 환경의 제약으로 보이며, 서비스 워커가 필요한 오프라인 항목(2번, 11번 일부, 13번)은 직접 확인하지 못했다.

## 1. 16절 완료 기준 13개

| 번호 | 기준 | 판정 | 증거 | 남은 문제 / 확인 방법 |
|---|---|---|---|---|
| 1 | 반영 시간 10회 최대 60초 | 미확인 | 참고: 스파이크 3번 개인 계정 10회 최대 3초 (`docs/spike.md` 결과 표 3번, 2026-11-08 21:10, 워커 타이머 기준). 본 코드는 60초마다 `getMeta`, 시작 지연 0~60초 (`js/display/main.js:204`, `js/core/net.js:5-7`) | 실제 키를 넣고 배포한 뒤 시크릿 창 학급 PC 화면을 열어 둔 채 입력 화면에서 10회 저장, 반영까지 시간을 잰다. 최대값을 이 문서에 적는다. 화면이 가려진 탭이면 최대 약 1분 더 늦을 수 있다(스파이크) |
| 2 | 오프라인 (a) 10분 뒤 '마지막 갱신' (b) 끊긴 채 재시작해도 열림 (c) 끊긴 채 부팅 후 연결되면 자동 갱신 | 미확인 | 코드: (a) `staleness` 10분 초과 '마지막 갱신 HH:MM', 24시간 초과 '며칠째 갱신되지 않음' (`js/core/net.js:18-24`), 분마다 다시 그림 (`js/display/main.js:206-214`). 테스트 `staleness` 통과. (b) `sw.js:4-29` SHELL, 이동 요청은 캐시의 index.html (`sw.js:58-67`), 마지막 본문 `classboard:board:<ID>` (`js/display/main.js:38-46`). (c) 실패 시 백오프 후 재확인, 캐시 없으면 30초·60초·5분 (`js/core/net.js:14-16`). `tests/sw-shell.test.js` 3개 통과(불러오는 파일이 모두 SHELL에 있음) | 내장 브라우저에서 서비스 워커 등록 실패로 직접 확인 못함. 실제 크롬에서: 표시 화면을 연 뒤 개발자 도구 Network를 Offline으로 10분+ 두어 구석 문구 확인 → 크롬을 닫았다가 Offline 상태로 다시 열어 내용 확인 → 랜선을 뺀 채 PC를 켜고 1~2분 뒤 랜선을 꽂아 갱신 확인 |
| 3 | 설치: 학급 PC·개인 PC, 크롬 열림/닫힘, 재시작 후 자동 실행, 복원 말풍선 없음 | 미확인 | `js/core/install.js` 명령줄·bat 생성, `tests/install.test.js` 통과, 안내서 `docs/설치-운영-안내서.md` | 실제 학급 PC 1대와 개인 PC 1대에서: [복사]한 명령줄로 shell:startup 바로가기 → 크롬을 켜 둔 상태와 끈 상태에서 각각 재시작 → 전체화면·주소창 없음 확인 → 작업 관리자로 크롬 강제 종료 후 재시작해 복원 말풍선 없음 확인. `.bat` 설치·제거도 같은 방법. 바로가기 인수의 `%LOCALAPPDATA%` 펼침 여부(계약 11절)와 엣지 동작도 확인 |
| 4 | 시간 계산 테스트 (자정, 09:44/09:45, 쉬는 시간, 공휴일, 방학, overrides, 안내 시작일=오늘/종료일=어제, UTC) | 통과 | `node --test tests/` 125개 통과, `TZ=UTC node --test tests/` 125개 통과 (추가로 `TZ=America/Los_Angeles`도 125개 통과). 해당 테스트: '자정 직전·직후'(time, timetable), '교시 경계 09:44 / 09:45', '쉬는 시간 09:50', '점심 12:40', '공휴일', '방학', 'overrides 병합', 'replaceAll', 'activeNotices: 시작일=오늘 포함', '종료일=어제 빠짐', 'PC 시간대가 UTC일 때'. 코드에 지역 시간 API(getHours 등) 사용 없음 | 없음 |
| 5 | 청소당번 순환 테스트 | 통과 | `tests/duty.test.js`: '주 단위, 학생 수가 나누어떨어지지 않음 (10명, 3명씩)', '시작일 이전', '일 단위 (주말 건너뜀)', '임시 교체: 바꾸기, 빼기…' 모두 통과 | 없음 |
| 6 | 보안 검색 결과 첨부, 저장소 밖 변경 0개 | 통과 | 아래 3절. 검색 결과 0줄. `git diff --stat main...feat/board`: 75개 파일, 7875줄 추가, 526줄 삭제. 추가 아닌 변경은 `spike/config.js`, `spike/index.html`, `spike/spike.js` 삭제 3개뿐(사용자 결정, 커밋 `8470e23`). 관련 저장소 `r`은 `M attendance/store.js` 하나(이 작업 전부터 있던 사용자 변경, 파일 마지막 커밋 2026-11-03) | 계약 12절의 'spike/ 변경 0개'는 사용자 결정으로 대체됨 |
| 7 | 공유 중지·삭제 후 로그인 없이 안 열림, 이력 비공유 | 미확인 | 가짜 드라이브에서 직접 확인: [지금 공유 끊기] → 확인 대화상자(처음 초점 '취소') → '공유 중지됨' → 표시 화면이 404 두 번 뒤 '주소 오류'로 바뀌고 `classboard:board:<ID>`, `classboard:ok:<ID>` 키가 지워짐. [게시판 삭제] → 학급 이름을 그대로 쳐야 [영구 삭제]가 켜짐 → 본 파일·이력 3개 모두 사라지고 이 PC 키 0개. 이력 파일 권한 0개. 코드: 이미지→이력→본 파일 순 `files.delete` (`js/admin/main.js:486-498`), 공유 끊기는 본 파일과 모든 이미지 (`js/admin/main.js:416-428`), 이력은 `parents:['appDataFolder']` (`js/admin/drive.js:213-216`). 참고: 스파이크에서 `permissions.delete` 뒤 24초 안에 404, `files.delete` 204 | 실제 드라이브에서: 게시판과 이미지 1개를 만든 뒤 [지금 공유 끊기] → 시크릿 창에서 표시 화면과 이미지 다운로드 주소가 404인지 → [다시 공유하기] 후 [게시판 삭제] → 시크릿 창 404, 드라이브 휴지통에 없음 확인. 이력은 `files.list?spaces=appDataFolder` 결과의 각 파일 `permissions.list`가 비어 있는지 |
| 8 | `f` 이상한 값이면 API 호출 없음 | 통과 | 내장 브라우저에서 `?dev=0&f=../x`, 19자, `<script>alert(1)</script>`, 공백 포함, `?f=../x`(가짜 모드) 모두 '주소 오류' 화면. 네트워크 목록에 `google` 포함 요청 0개. 키를 넣은 `createKeySource({apiKey:'TESTKEY'})`의 `getMeta/getText/getImage`에 위 값과 빈 값, 81자, `%2e%2e%2f…`를 넣어도 모두 요청 전에 `DriveError('invalid')`, `performance` 기록의 googleapis 0개. 코드: `isValidFileId` `/^[A-Za-z0-9_-]{20,80}$/` (`js/core/ids.js:3-5`), `encodeURIComponent` (`js/core/drive-common.js:67-70`), 시작 시 검사 (`js/display/main.js:191-195`) | 없음 |
| 9 | 학교 계정 공유가 막히면 안내 문구 | 미확인 | 코드: 공유 만들기 403/400 → `shareBlocked` → '이 계정은 링크 공유가 허용되지 않습니다. 개인 구글 계정으로 로그인하세요' (`js/core/drive-common.js:61`, 문구 15행), 만든 파일은 지움 (`js/admin/drive.js:112-121`). 테스트 '만들기: 공유가 막히면 파일을 지우고 shareBlocked', classifyDriveError 403/400 통과. 참고: 스파이크 8번에서 학교 도메인 `ob-m.goedy.kr`은 공유가 막히지 않았다(그래서 실제 문구는 아직 본 적 없음) | 링크 공유를 막은 워크스페이스 계정(관리 콘솔에서 '외부 공유 사용 안 함' 상태인 시험 계정)으로 [새 게시판 만들기] → 문구가 나오고 드라이브에 파일이 남지 않는지 확인 |
| 10 | 1280x720, 1366x768, 1920x1080 최악 데이터에서 글자 안 잘림 (스크린샷 3장) | 통과 | `index.html?dev=1&seed=worst&now=2026-11-10T10:05`를 세 크기에서 직접 열어 DOM 측정: `overflow`가 막힌 요소 중 넘치는 것은 학급 이름 줄 높이 3~6px(줄 간격 부분, 글자 상자 안 잘림, 의도된 너비만 검사 `render.js:29-30`)뿐, 화면 밖 요소 0개. 1280x720·1920x1080에서 안내 50페이지를 모두 그려 봐도 넘침 0개. 학급 이름 40자 전부 표시, 안내 본문 500자 전부 표시, 10교시, 일정 5개 + '외 15건', 구역 12개. 기존 스크린샷 `docs/screenshots/worst-1280x720.png`, `worst-1366x768.png`, `worst-1920x1080.png` 내용과 일치. 내장 브라우저 창이 작아 새 스크린샷은 찍지 않았다 | 잘리지는 않지만 칸을 줄여 맞추느라 글자가 작아진다: 1280x720에서 청소당번 칸 `--fit 0.6`(글자 11.2px), 메모 8.4px. 글자 크기 1.4에서는 잘림 발생 (문제 M1) |
| 11 | 이미지 EXIF 제거, 500KB 이하, 안내 삭제 시 영구 삭제, 오프라인 표시 | 부분 통과 | 내장 브라우저에서 `js/admin/image.js`의 `toJpeg` 직접 실행: EXIF(APP1 `Exif` + 표시 문자열)를 넣은 JPEG → 결과에 `Exif`·표시 문자열 없음. 4000x3000 무작위 잡음 PNG(41MB) → 1600x1200, 464,640바이트 JPEG. 가짜 드라이브에서 이미지 올리기(공유 anyone/reader/allowFileDiscovery false 확인) → 안내에 붙여 저장 → 안내 삭제(경고 '이 안내에 붙인 이미지도 저장할 때 영구 삭제됩니다') → 저장 → 이미지 파일과 저장소 항목이 사라짐. 코드 `removedFileIds` + `deleteFile` (`js/admin/main.js:391-395`), 저장 안 된 이미지는 즉시 삭제 (`js/admin/tab-images.js:29-38`) | 오프라인 표시는 미확인(서비스 워커 확인 불가, 2번과 같은 방법으로 이미지가 붙은 안내를 띄워 확인). 이미지 Cache Storage 보관 코드는 `js/display/images.js:16-35` |
| 12 | 모든 색 묶음 대비 4.5:1, 칸 끄기·순서 변경 반영 | 통과 | `checkPalette` 4개 묶음 모두 ok, 최저값 honey 5.16, brown 5.02, sand 5.16, night 6.15 (입력 화면 디자인 탭에도 같은 값 표시). 입력 화면(가짜 모드)에서 색 묶음 '짙은 바탕' 선택, '일정' 끄기, '안내' 아래로, 저장 → 표시 화면 `--b-bg #1B150E`, 칸 `timetable, notices`(일정 빠짐). 최악 게시판에서 '청소당번' 위로 두 번 + '짙은 갈색' 저장 → 표시 화면 칸 순서 `timetable, duty, notices, events`, `--b-bg #6B4410`. 입력 화면 미리보기도 같은 순서 | 배경 이미지 + 덮개 0.5에서 구석 경고 글자 대비는 검사 대상 밖 (문제 L3) |
| 13 | 서비스 워커 갱신 후 새 배포 24시간 안 반영 | 미확인 | 코드: 시작 때와 6시간마다 `registration.update()` (`js/display/main.js:142-152`), `skipWaiting`+`clients.claim`, 처음 설치가 아닐 때 `controllerchange`에서 다시 읽기, 새벽 3~5시 같은 출처 `sw.js` fetch 성공 시 재로드 (`js/display/main.js:132-140`, `js/core/net.js:31-34`). 이번 브랜치 커밋 중 SHELL 파일을 바꾼 커밋은 `8980094`(sw.js를 처음 만든 커밋) 하나라 VERSION 규칙 위반 없음 | 배포 후 학급 PC를 켜 둔 채 SHELL 파일 하나와 VERSION을 바꿔 배포 → 24시간 안에(재부팅 없이) 바뀐 화면이 되는지, 개발자 도구 Application > Service Workers에서 새 VERSION 캐시 `classboard:shell:<새 값>`만 남는지 확인. 밤에 PC를 끄는 학교는 새벽 재로드가 안 일어나므로 아침 부팅 때 반영되는지도 확인 |

## 2. 사용자 절대 규칙 12개

| 번호 | 규칙 | 판정 | 증거 |
|---|---|---|---|
| 1 | 새 파일은 이 저장소 안에만, 다른 저장소 import 없음 | 통과 | `git diff --name-status main...feat/board`: 추가 72개 + `spike/` 삭제 3개. import는 모두 `./`, `../core`, `../display`, `../fake-store`, `../../config.js`, 테스트의 `node:`·`../js/`뿐(저장소 밖 경로 0). `r` 저장소는 사용자의 기존 변경 `attendance/store.js` 하나 |
| 2 | 서버·빌드 도구 없음 | 통과 | `package.json`·빌드 설정 없음, ES 모듈 정적 파일. 테스트는 `node --test` |
| 3 | 외부 코드 금지, 글꼴은 fonts/와 OFL, 예외는 admin 구글 로그인, index.html 외부 스크립트 0 | 통과 | `fonts/IBMPlexSansKR-{Regular,Medium,SemiBold}.woff2` + `fonts/OFL-LICENSE.txt`, `@font-face`는 `../fonts/`만 (`css/tokens.css:3-5`). `index.html` 스크립트는 `./js/display/main.js` 하나. 외부 스크립트는 로그인 때 `js/admin/drive.js:7,36-50`이 넣는 `https://accounts.google.com/gsi/client`뿐 |
| 4 | innerHTML 등 금지, a·링크 금지, 굵게는 strong | 통과 | 아래 3절 검색 0줄. 추가 검색(`outerHTML`, `new Function`, `<a`, `createElement('a')`, 문자열 setTimeout) 0줄. 굵게는 `h('strong', …)` (`js/display/render.js:85`) |
| 5 | nameMode 기본 number, masked/full 경고+확인, number면 이름 저장·업로드 없음 | 통과 | 기본값 `nameMode:'number'` (`js/core/schema.js:26`). 가짜 모드에서 full 선택 시 '링크가 새면 학생 이름이 공개됩니다. 그래도 켤까요?' 확인, 취소하면 number 유지. number에서 '1번 이름'에 이름을 넣고 저장 → 저장 파일·localStorage·sessionStorage 어디에도 이름 없음. `withNames` (`js/core/edit.js:16-23`), number에 이름이 있으면 검사 실패 (`js/core/schema.js:363-365`, 테스트 통과) |
| 6 | 저장 키 모두 `classboard:` 접두사 | 통과 | 아래 4절 |
| 7 | Asia/Seoul, 'YYYY-MM-DD' 비교 | 통과 | `js/core/time.js:3-7` `Intl.DateTimeFormat(timeZone:'Asia/Seoul')`, 날짜 계산은 UTC 정오. `getHours/getDate/toLocale…` 사용 0개. UTC·LA 시간대 테스트 통과 |
| 8 | 스키마 검사(상한), 파일 ID 정규식·encodeURIComponent, 실패 시 마지막 정상 내용 유지 | 통과 | `LIMITS` (`js/core/schema.js:7-8`) 안내 활성 50, 제목 40, 본문 500, 일정 200, 교시 12, 구역 12, 이미지 20, 200KB. 상한 테스트 통과. 검사 실패 시 `state.board`를 바꾸지 않고 '내용을 읽지 못해 이전 내용을 표시합니다' (`js/display/main.js:99-107`). 파일 ID는 8번 참고 |
| 9 | 이력 appDataFolder, 삭제는 files.delete, 공유 anyone/reader/allowFileDiscovery false + permissions.list 확인 후 완료, 파일 이름에 반 이름 없음 | 통과 (코드·가짜 드라이브). 실제 드라이브는 16절 7번 미확인 | `js/admin/drive.js:96-121` 만들기→목록 확인→2초 뒤 재확인→실패면 파일 삭제. `DELETE ${API}/{id}`만 사용(휴지통 이동 없음). 파일 이름 `board-<무작위12>.json`, `img-<무작위12>.jpg`, `classboard-hist-<파일ID>-<rev>.json` (`js/core/ids.js:20-30`) |
| 10 | 이모지·장식 기호 금지, 단색 SVG, 디자인 토큰, 글꼴 하나, tabular-nums | 통과 | 소스의 비한글 문자 전수 검사: 화면 글에 나오는 것은 가운뎃점 `·`, 가린 이름 `○`(계약 예외)뿐, 화살표 `→`·`…`·`×`는 주석에만. 아이콘은 `currentColor` 단색 선 SVG (`js/admin/ui.js:22-42`). 색은 `js/core/palette.js`와 `css/admin.css:4-14` 변수. 글꼴은 IBM Plex Sans KR 하나. `font-variant-numeric: tabular-nums` (`css/board.css:27`, `css/admin.css:42`). 통과 글자색은 계약 4-3에 따라 #4A6326 |
| 11 | 버튼 44px+, 키보드, 포커스, aria-live, 입력 화면 상단 개인정보 안내 상시 | 통과 | 가짜 모드에서 7개 탭을 모두 열고(접힌 칸도 펼침) 버튼·탭·summary 크기 측정: 44px 미만 0개, 라벨 없는 입력 0개. 키보드만으로: Enter로 로그인 → Tab으로 학급 이름 → 입력·Enter로 만들기 → 방향키로 '디자인' 탭 → Tab·방향키로 색 묶음 → Space로 '일정' 끄기 → Enter로 '아래로' → Ctrl+S 저장까지 완료. 포커스 링 3px 실선(`:focus-visible`), 다시 그린 뒤에도 초점 유지. 알림 `role="status" aria-live="polite"` (`admin.html:29`). 상단 고정 안내 `admin.html:15` (sticky 머리) |
| 12 | 시간 고정 입력 테스트 모두 통과 | 통과 | 125/125 (기본, TZ=UTC, TZ=America/Los_Angeles) |

## 3. 보안 검색 (16절 6번)

```
$ grep -rnE "src=\"http|href=\"http|import .* from ['\"]http|innerHTML|insertAdjacentHTML|document\.write|eval\(" --include=*.js --include=*.html --include=*.css .
(출력 없음, 종료 코드 1)
```

```
$ git diff --stat main...feat/board
 ... (75 files)
 75 files changed, 7875 insertions(+), 526 deletions(-)
$ git diff --name-status main...feat/board | grep -v "^A"
D	spike/config.js
D	spike/index.html
D	spike/spike.js
```

```
$ cd C:\Users\hanso\tmp-class\r && git status --short
 M attendance/store.js        (브랜치 feat/sgb-checker, 이 작업 전부터 있던 사용자 변경)
```

테스트:
```
$ node --test tests/            → tests 125, pass 125, fail 0
$ TZ=UTC node --test tests/     → tests 125, pass 125, fail 0
```

## 4. 저장 키와 외부 주소

저장 키 (localStorage/sessionStorage `setItem/getItem/removeItem`, `caches.open/delete`, `indexedDB`):

| 위치 | 키 | 접두사 |
|---|---|---|
| `js/display/main.js:27` | `classboard:${part}:${fileId}` (board, ok, reload) | 맞음 |
| `js/display/images.js:4` | `classboard:img:<게시판ID>` | 맞음 |
| `sw.js:3` | `classboard:shell:<VERSION>`, 지우기도 이 접두사만 (`sw.js:47`) | 맞음 |
| `js/admin/drive.js:8` | sessionStorage `classboard:admin:token` | 맞음 |
| `js/core/fake-drive.js:6-7`, `js/display/fake-source.js:5-7` | `classboard:fake:index`, `classboard:fake:text:`, `classboard:fake:img` | 맞음 |
| `js/fake-store.js:5-8` | `classboard:fake:`가 아니면 throw | 맞음 |
| `js/admin/main.js:497-498` | 삭제 시 `classboard:` 시작 + `:<ID>` 끝 키, `classboard:img:<ID>` | 맞음 |

IndexedDB 사용 0개. `classboard:` 아닌 저장 키 0개.

외부 주소 (테스트 제외, 소스 전체 `https?://` 검색):

| 파일 | 주소 | 용도 |
|---|---|---|
| `js/core/drive-common.js:4-6` | `https://www.googleapis.com/drive/v3/files`, `/upload/drive/v3/files`, `/download/drive/v3/files` | 드라이브 읽기·쓰기 (표시 화면은 drive/v3 메타와 download만) |
| `js/core/drive-common.js:8` | `https://www.googleapis.com/auth/drive.file`, `.../drive.appdata` | OAuth 범위 문자열 (요청 아님) |
| `js/admin/drive.js:7` | `https://accounts.google.com/gsi/client` | 입력 화면 로그인 스크립트 (로그인 때만 삽입) |
| `js/admin/ui.js:22` | `http://www.w3.org/2000/svg` | SVG 이름공간 (요청 아님) |
| `config.js:3` | `https://176-oss.github.io/` | 주석 |

## 5. 코드 읽기 확인 (작업 4)

| 항목 | 결과 | 위치 |
|---|---|---|
| 백오프 | 실패 횟수 n → 1, 2, 5, 10분(±20% 흔들기, 10분 상한). 캐시 없으면 30초·60초·5분. 성공하면 n=0 | `js/core/net.js:9-16`, `js/display/main.js:115-126` |
| 경고 단계 | 10분 초과 '마지막 갱신 HH:MM', 24시간 초과 '며칠째 갱신되지 않음', 오른쪽 아래 `warn` 색, 가리는 창 없음 | `js/core/net.js:18-24`, `js/display/main.js:48-58` |
| 시계 어긋남 | `updatedAt`이 PC 시각보다 5분 넘게 미래면 '이 PC의 시계를 확인하세요'. 서버 시각 헤더 안 씀 | `js/core/net.js:26-29` |
| 새벽 재로드 | 서울 03:00~05:00, 그날 처음, `./sw.js?ping=` 200일 때만 날짜 기록 후 재로드 | `js/core/net.js:31-34`, `js/display/main.js:132-140` |
| 이미지 EXIF·크기 | canvas 다시 그리기, 긴 변 1600, 품질 0.85→0.50, 그래도 크면 0.8배 축소, 상한 512,000바이트(500KiB) | `js/admin/image.js:5-39` |
| 안내 삭제 시 이미지 | 그 안내만 쓰던 이미지면 경고 후 목록에서 빼고, 저장 때 `files.delete`. 저장 전 올린 이미지는 바로 삭제. 열 때 24시간 넘은 고아 이미지 삭제 | `js/admin/tab-notices.js:30-46`, `js/admin/tab-images.js:29-38`, `js/admin/main.js:254,391-395` |
| 공유 끊기·삭제와 이력 | 공유 끊기는 본 파일·모든 이미지의 anyone 권한 삭제(이력은 원래 공유 불가라 손대지 않음). 삭제는 이미지 → 이력 전부 → 본 파일, 중간 실패면 멈추고 다시 누르면 나머지 | `js/admin/main.js:416-428,467-505` |
| number 모드 이름 | 이름은 메모리(`S.names`)만, 저장 모양에서 빠짐, 검사도 막음 | `js/admin/state.js:9`, `js/core/edit.js:16-23` |
| 서비스 워커 VERSION | 규칙 주석 `sw.js:1`. 테스트는 형식만 검사(올렸는지는 사람이 봄). 현재 브랜치에서 위반 없음 | `sw.js:2`, `tests/sw-shell.test.js:38-40` |

## 6. 발견한 문제

| 번호 | 심각도 | 위치 | 내용 | 재현 | 담당 |
|---|---|---|---|---|---|
| M1 | 중간 | `js/display/render.js:30-37` (`fit` 하한 0.45), `css/board.css:45` (`overflow: hidden`) | 글자 크기(`fontScale`)를 허용 최대 1.4로 두면 최악 데이터에서 청소당번 칸이 하한까지 줄어도 넘쳐 메모 줄이 잘린다(1280x720: 칸 높이 238px에 내용 268px, 메모가 화면 아래 728px까지). 기본 1.0에서도 1280x720 청소당번 글자 11.2px, 메모 8.4px로 기획서 11절 '본문 28px 상당'(1280에서 약 18.7px)에 크게 못 미친다 | 가짜 모드 `index.html?dev=1&seed=worst&now=2026-11-10T10:05`를 1280x720으로 열고, 디자인 탭에서 글자 크기 140%로 저장(또는 `renderBoard`에 `fontScale:1.4`) → 청소당번 칸 아래가 잘림 | A |
| L1 | 낮음 | `js/admin/drive.js:92-93` | 공유 목록 읽기(`permissions.list`)도 `op:'share'`라, 권한 없는 403이면 '이 계정은 링크 공유가 허용되지 않습니다…'로 잘못 안내된다(실제로는 '이 파일에 접근할 권한이 없습니다…'가 맞음). 게시판을 열 때 공유 상태 확인과 [지금 공유 끊기]에 해당 | 다른 계정이 만든 파일 ID로 `shareState`를 부르게 하면 됨 (실제 드라이브 필요) | B |
| L2 | 낮음 | `js/admin/tab-images.js:40-42` | 공유를 끊어 둔 상태('공유 중지됨')에서 이미지를 올려도 그 이미지는 바로 링크 공유된다. 본 파일이 비공유라 ID가 새지는 않지만 '공유 중지' 상태와 어긋난다 | 가짜 모드에서 [지금 공유 끊기] 후 이미지 올리기 → `classboard:fake:index`의 그 이미지 `perms`에 anyone 항목 (직접 확인함) | B |
| L3 | 낮음 | `js/display/render.js:39-44,158-167`, `css/board.css:119` | 배경 이미지 + 덮개(0.5까지 허용)일 때 구석 경고·'가짜 드라이브 모드' 글자는 칸(`surface`) 밖 덮개 위에 있어 4.5:1이 보장되지 않는다(`checkPalette`는 단색 바탕만 검사) | 배경 이미지를 밝은 사진으로, 덮개 0.5로 저장하고 네트워크를 끊어 10분 뒤 문구 확인 | A |
| L4 | 낮음 | `js/admin/tab-images.js:65` | 기획서 5절 '이미지 올릴 때 경고를 띄운다'를 고르기 버튼 위 상시 경고 상자(`aria-describedby` 연결)로 처리했다. 계약 10-2('고르기 전에')와는 맞으나, 대화상자 확인을 기대했다면 다름 | 이미지 탭 [그림 고르기] → 경고 대화상자 없이 파일 창이 열림 | B (기획 확인 후) |
| L5 | 낮음 | `js/core/drive-common.js:82-86`, `js/display/main.js:178-189` | `?dev=1`은 배포 주소에서도 가짜 모드를 켜고, `&seed=worst`를 붙이면 배포 출처 localStorage에 가짜 데이터가 써진다. 계약 6절대로이고 구글로 보내는 것은 없어 위험은 낮다. 교사가 실수로 `dev=1`이 붙은 주소로 설치하면 화면이 실제 게시판을 읽지 않는다 | 배포 주소 `index.html?dev=1&seed=worst` | A (그대로 둘지 기획 판단) |

실패로 판정한 기준은 없다. 높음 심각도 문제는 찾지 못했다.

## 7. 사람이 확인할 항목과 방법

1. **반영 시간 (16-1)**: `config.js`에 실제 키를 넣고 VERSION을 올려 배포 → 시크릿 창으로 `index.html?f=<ID>` → 입력 화면에서 10회 저장(매번 안내 제목을 바꿈), 저장 시각과 표시 화면 바뀐 시각 차이를 기록, 최대 60초 이하인지.
2. **오프라인 (16-2, 11 오프라인 이미지)**: 실제 크롬(앱 모드)에서 이미지가 붙은 안내를 띄운 뒤 (a) 개발자 도구 Network Offline 10분 → '마지막 갱신 HH:MM' (b) Offline 그대로 크롬 종료·재실행 → 마지막 내용과 이미지 표시 (c) 랜선 뺀 채 PC 부팅 → 연결 → 1~5분 안에 최신 내용.
3. **설치 (16-3)**: 학급 PC 1대, 개인 PC 1대. 크롬 열림/닫힘 × 수동 바로가기/`.bat` 각각 재시작, 전체화면·자동 실행·복원 말풍선 없음, `%LOCALAPPDATA%` 펼침, Alt+F4 종료, `ClassBoard-uninstall.bat` 제거.
4. **공유 끊기·삭제 (16-7)**: 실제 드라이브에서 위 1절 7번 방법. 이력 파일 `permissions.list`가 비어 있는지.
5. **학교 계정 (16-9)**: 링크 공유가 막힌 워크스페이스 계정으로 [새 게시판 만들기] → 문구와 파일 미잔존. 스파이크 8번 도메인은 막히지 않았으므로 다른 학교 도메인 필요.
6. **24시간 반영 (16-13)**: 학급 PC를 켜 둔 상태에서 SHELL 파일 변경 + VERSION 올려 배포 → 24시간 안 반영과 이전 `classboard:shell:*` 캐시 삭제 확인. 밤에 PC를 끄는 경우 다음 날 부팅 때 반영되는지도.
7. **M1 결정**: 최악 데이터에서 글자 하한(현재 0.45배)을 올리고 페이지로 넘길지, 글자 크기 1.4 상한을 낮출지 A가 정해 고친 뒤 10번을 다시 잰다.
