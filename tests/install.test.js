import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayUrl, checkUrl, commandLine, installBat, uninstallBat, BROWSER_PATHS } from '../js/core/install.js';

const ID = 'AbCdEfGhIjKlMnOpQrSt_-12';
const U = displayUrl('https://176-oss.github.io/class-board/', ID);

// 한글 줄은 같은 구역(라벨 사이)에서 chcp 65001 다음에만 와야 한국어 Windows cmd 가 줄을 잘못 읽지 않는다.
function koreanAfterChcp(bat) {
  let utf8 = false;
  for (const line of bat.split('\r\n')) {
    if (line.startsWith(':')) utf8 = false;
    if (line === 'chcp 65001 >nul') utf8 = true;
    if (/[^\x00-\x7F]/.test(line)) assert.ok(utf8, line);
  }
}

test('displayUrl 은 ?f=ID, 잘못된 ID 는 throw', () => {
  assert.equal(U, `https://176-oss.github.io/class-board/?f=${ID}`);
  assert.throws(() => displayUrl('https://176-oss.github.io/class-board/', '../x'));
});

test('명령줄 원문 (크롬)', () => {
  assert.equal(commandLine({ url: U }),
    `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --app=${U} --start-fullscreen --user-data-dir=%LOCALAPPDATA%\\ClassBoard --hide-crash-restore-bubble`);
});

test('엣지, 직접 경로, kiosk', () => {
  const edge = commandLine({ browser: 'edge', url: U });
  assert.equal(BROWSER_PATHS.edge, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
  assert.equal(edge, `"${BROWSER_PATHS.edge}" --app=${U} --start-fullscreen --user-data-dir=%LOCALAPPDATA%\\ClassBoard --hide-crash-restore-bubble`);
  assert.ok(commandLine({ browserPath: 'D:\\Chrome\\chrome.exe', url: U }).startsWith('"D:\\Chrome\\chrome.exe" '));
  const k = commandLine({ url: U, kiosk: true });
  assert.ok(k.includes(' --kiosk ') && !k.includes('--start-fullscreen'));
  assert.throws(() => commandLine({ browserPath: 'C:\\a"&calc.exe', url: U }));
});

test('이상한 주소는 거절', () => {
  const bad = [
    '', 123, undefined, `${U}&x=1`, `${U}"`, `${U}%TEMP%`, `${U}^`, `${U}|calc`, `${U}>x`, `${U}<x`,
    'https://176-oss.github.io/class-board/?f=../x', 'https://176-oss.github.io/class-board/?f=short',
    `https://176-oss.github.io/a b/?f=${ID}`, `javascript:alert(1)//?f=${ID}`, `${U}\r\ndel x`, `https://x.io/(a)/?f=${ID}`,
  ];
  for (const u of bad) {
    assert.throws(() => checkUrl(u), undefined, String(u));
    assert.throws(() => installBat({ url: u }), undefined, String(u));
    assert.throws(() => commandLine({ url: u }), undefined, String(u));
  }
  assert.equal(checkUrl(`http://localhost:8803/?f=${ID}`), `http://localhost:8803/?f=${ID}`);
  assert.ok(checkUrl(`https://176-oss.github.io/class-board/index.html?f=${ID}`));
});

test('설치 bat: CRLF, chcp 65001, 주소, 탐색 순서, 존재 확인, 지연', () => {
  const bat = installBat({ url: U });
  assert.ok(bat.endsWith('\r\n'));
  assert.equal(bat.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal(bat.includes('\r\r'), false);
  assert.ok(bat.startsWith('@echo off\r\nsetlocal\r\n'));
  assert.ok(bat.includes('\r\nchcp 65001 >nul\r\n'));
  koreanAfterChcp(bat);
  assert.ok(bat.includes(`set "URL=${U}"\r\n`));
  const order = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
    '%ProgramFiles%\\Google\\Chrome',
    '%ProgramFiles(x86)%\\Google\\Chrome',
    '%LOCALAPPDATA%\\Google\\Chrome',
    'App Paths\\msedge.exe',
    '%ProgramFiles(x86)%\\Microsoft\\Edge',
    '%ProgramFiles%\\Microsoft\\Edge',
  ].map((s) => bat.indexOf(s));
  assert.ok(order.every((i) => i > 0), String(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  // (x86) 경로가 괄호 블록 안에 있으면 cmd 가 블록을 잘못 끊는다.
  for (const line of bat.split('\r\n').filter((l) => l.includes('(x86)'))) assert.ok(line.startsWith('if not defined BROWSER if exist '), line);
  assert.ok(bat.includes('timeout /t 25 /nobreak ^>nul'));
  assert.ok(bat.includes('Startup\\ClassBoard.lnk'));
  assert.ok(bat.includes("GetFolderPath('Desktop')"));
  assert.ok(bat.includes('$s.WindowStyle = 7'));
  assert.ok(bat.includes('if not exist "%CB_STARTUP%" goto fail'));
  assert.ok(bat.includes('Test-Path -LiteralPath $p'));
  assert.ok(bat.includes('크롬과 엣지를 찾지 못했습니다. 수동 설치 방법을 따르세요.'));
  assert.ok(bat.includes('바로가기를 만들지 못했습니다 (PowerShell이 막혀 있을 수 있습니다). 수동 설치 방법을 따르세요.'));
  assert.ok(bat.includes('설치했습니다. PC를 다시 켜면 게시판이 열립니다. 끄려면 Alt+F4.'));
  assert.ok(bat.includes('--start-fullscreen') && !bat.includes('--kiosk'));
  assert.equal(bat.charCodeAt(0), 0x40);
});

test('설치 bat: kiosk', () => {
  const bat = installBat({ url: U, kiosk: true });
  assert.ok(bat.includes('--kiosk') && !bat.includes('--start-fullscreen'));
});

test('제거 bat', () => {
  const bat = uninstallBat();
  assert.equal(bat.replace(/\r\n/g, '').includes('\n'), false);
  koreanAfterChcp(bat);
  assert.ok(bat.includes('del /q "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\ClassBoard.lnk"'));
  assert.ok(bat.includes("GetFolderPath('Desktop')"));
  assert.ok(bat.includes('rmdir /s /q "%LOCALAPPDATA%\\ClassBoardLauncher"'));
  assert.ok(bat.includes('choice /c YN /m "학급 PC 화면이 보관한 내용(%LOCALAPPDATA%\\ClassBoard)도 지울까요? 게시판 창을 먼저 닫으세요"'));
  assert.ok(bat.includes('rmdir /s /q "%LOCALAPPDATA%\\ClassBoard"'));
  assert.ok(bat.includes('pause'));
});
