// 학급 PC 연결 (계약 11절): 표시 주소, 바로가기 명령줄, 설치·제거 .bat 글.
import { isValidFileId } from './ids.js';

export const BROWSER_PATHS = {
  chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  edge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
};
export const INSTALL_FILE = 'ClassBoard-install.bat';
export const UNINSTALL_FILE = 'ClassBoard-uninstall.bat';

export function displayUrl(base, fileId) {
  if (!isValidFileId(fileId)) throw new TypeError('파일 ID 형식이 아닙니다');
  return `${base}?f=${encodeURIComponent(fileId)}`;
}

// bat 과 바로가기에 그대로 들어가므로 displayUrl 모양(영문 주소 + ?f=ID)만 받아 cmd 특수문자가 끼어들 틈을 없앤다.
export function checkUrl(url) {
  const m = typeof url === 'string' && /^https?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?\/[A-Za-z0-9._~\/-]*\?f=([A-Za-z0-9_-]+)$/.exec(url);
  if (!m || !isValidFileId(m[1])) throw new TypeError('표시 주소 형식이 아닙니다');
  return url;
}

const flags = (kiosk) => (kiosk ? '--kiosk' : '--start-fullscreen');

export function commandLine({ browser = 'chrome', browserPath, url, kiosk = false }) {
  const exe = browserPath || BROWSER_PATHS[browser];
  if (!exe || /["%^&<>|\r\n]/.test(exe)) throw new TypeError('브라우저 경로가 올바르지 않습니다');
  return `"${exe}" --app=${checkUrl(url)} ${flags(kiosk)} --user-data-dir=%LOCALAPPDATA%\\ClassBoard --hide-crash-restore-bubble`;
}

const crlf = (lines) => lines.join('\r\n') + '\r\n';
// 한국어 Windows 10 cmd 는 맨 위에서 chcp 65001 로 바꾼 UTF-8 bat 의 줄 위치를 잘못 읽어서(직접 확인) 한글 줄은 끝 구역에 모으고 그 바로 앞에서만 바꾼다.
const APP = 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths';
const regFind = (root, exe) =>
  `if not defined BROWSER for /f "tokens=2,*" %%A in ('reg query "${root}\\${APP}\\${exe}" /ve 2^>nul ^| find "REG_SZ"') do set "BROWSER=%%B"`;
const fileFind = (path) => `if not defined BROWSER if exist "${path}" set "BROWSER=${path}"`;
// 레지스트리 값이 없는 파일을 가리키면 다음 후보로 넘어가게 비운다.
const dropMissing = 'if defined BROWSER if not exist "%BROWSER%" set "BROWSER="';
const STARTUP = '%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\ClassBoard.lnk';
const DESKTOP_PS = "(Join-Path ([Environment]::GetFolderPath('Desktop')) 'ClassBoard.lnk')";

export function installBat({ url, kiosk = false }) {
  checkUrl(url);
  return crlf([
    '@echo off',
    'setlocal',
    `set "URL=${url}"`,
    'set "BROWSER="',
    regFind('HKLM', 'chrome.exe'), dropMissing,
    regFind('HKCU', 'chrome.exe'), dropMissing,
    fileFind('%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe'),
    fileFind('%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe'),
    fileFind('%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe'),
    regFind('HKLM', 'msedge.exe'), dropMissing,
    fileFind('%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe'),
    fileFind('%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe'),
    'if not defined BROWSER goto nobrowser',
    `set "CB_ARGS=--app=%URL% ${flags(kiosk)} --user-data-dir="%LOCALAPPDATA%\\ClassBoard" --hide-crash-restore-bubble"`,
    'set "CB_DIR=%LOCALAPPDATA%\\ClassBoardLauncher"',
    'set "CB_LAUNCH=%CB_DIR%\\start.cmd"',
    `set "CB_STARTUP=${STARTUP}"`,
    'if not exist "%CB_DIR%" mkdir "%CB_DIR%"',
    // (x86) 경로가 괄호 블록을 끊지 않게 블록 없이 한 줄씩 앞에서 리디렉션한다.
    '>"%CB_LAUNCH%" echo @echo off',
    '>>"%CB_LAUNCH%" echo timeout /t 25 /nobreak ^>nul',
    '>>"%CB_LAUNCH%" echo start "" "%BROWSER%" %CB_ARGS%',
    'if not exist "%CB_LAUNCH%" goto fail',
    'powershell -NoProfile -Command "$w = New-Object -ComObject WScript.Shell; ' +
      '$s = $w.CreateShortcut($env:CB_STARTUP); $s.TargetPath = $env:CB_LAUNCH; $s.WindowStyle = 7; $s.Save(); ' +
      `$p = ${DESKTOP_PS}; $d = $w.CreateShortcut($p); $d.TargetPath = $env:BROWSER; $d.Arguments = $env:CB_ARGS; $d.Save(); ` +
      'if (-not (Test-Path -LiteralPath $p)) { exit 1 }"',
    'if errorlevel 1 goto fail',
    'if not exist "%CB_STARTUP%" goto fail',
    'chcp 65001 >nul',
    'echo 브라우저: %BROWSER%',
    'echo 설치했습니다. PC를 다시 켜면 게시판이 열립니다. 끄려면 Alt+F4.',
    'pause',
    'exit /b 0',
    ':nobrowser',
    'chcp 65001 >nul',
    'echo 크롬과 엣지를 찾지 못했습니다. 수동 설치 방법을 따르세요.',
    'pause',
    'exit /b 1',
    ':fail',
    'chcp 65001 >nul',
    'echo 바로가기를 만들지 못했습니다 (PowerShell이 막혀 있을 수 있습니다). 수동 설치 방법을 따르세요.',
    'pause',
    'exit /b 1',
  ]);
}

export function uninstallBat() {
  return crlf([
    '@echo off',
    'setlocal',
    `if exist "${STARTUP}" del /q "${STARTUP}"`,
    // PowerShell 이 막혀도 기본 바탕화면 위치의 바로가기는 지운다.
    'if exist "%USERPROFILE%\\Desktop\\ClassBoard.lnk" del /q "%USERPROFILE%\\Desktop\\ClassBoard.lnk"',
    `powershell -NoProfile -Command "Remove-Item -LiteralPath ${DESKTOP_PS} -ErrorAction SilentlyContinue" 2>nul`,
    'if exist "%LOCALAPPDATA%\\ClassBoardLauncher" rmdir /s /q "%LOCALAPPDATA%\\ClassBoardLauncher"',
    'chcp 65001 >nul',
    'echo 시작프로그램과 바탕화면의 ClassBoard 바로가기를 지웠습니다.',
    'choice /c YN /m "학급 PC 화면이 보관한 내용(%LOCALAPPDATA%\\ClassBoard)도 지울까요? 게시판 창을 먼저 닫으세요"',
    'if errorlevel 2 goto done',
    'if exist "%LOCALAPPDATA%\\ClassBoard" rmdir /s /q "%LOCALAPPDATA%\\ClassBoard"',
    'if exist "%LOCALAPPDATA%\\ClassBoard" (echo 보관 내용을 다 지우지 못했습니다. 게시판 창을 닫고 다시 실행하세요.) else (echo 보관 내용을 지웠습니다.)',
    ':done',
    'chcp 65001 >nul',
    'echo 제거를 마쳤습니다.',
    'pause',
  ]);
}
