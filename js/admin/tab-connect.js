// 학급 PC 연결 탭: 표시 주소, 설치 안내(명령줄, .bat), 미리보기, 공유 상태, 되돌리기, 삭제.
import { S, hooks } from './state.js';
import { h, field, button, say, check, radios } from './ui.js';
import { displayUrl, commandLine, installBat, uninstallBat, INSTALL_FILE, UNINSTALL_FILE } from '../core/install.js';

export const boardUrl = () => displayUrl(new URL('./', location.href).href, S.fileId);

// 다른 탭을 다녀와도 고른 값이 남게 모듈에 둔다 (저장하지 않음).
const opt = { browser: 'chrome', kiosk: false };

async function copy(text, el, what) {
  try {
    await navigator.clipboard.writeText(text);
    say(`${what} 복사했습니다`);
  } catch {
    el.focus();
    el.select();
    say(`${what} 골라 두었습니다. Ctrl+C로 복사하세요`);
  }
}

const MANUAL = [
  '1. Win+R을 누르고 shell:startup 을 입력합니다.',
  '2. 열린 폴더 빈 곳에서 오른쪽 클릭 > 새로 만들기 > 바로 가기.',
  '3. 항목 위치에 위 명령줄을 붙여 넣고 이름을 ClassBoard 로 합니다.',
  '4. PC를 다시 켜서 게시판이 열리는지 봅니다. 끄려면 Alt+F4.',
];

function installSection(url) {
  const cmd = h('textarea', { readOnly: true, rows: 4, class: 'mono', 'data-key': 'cmd', spellcheck: false });
  const kioskWarn = h('p', { class: 'warn-box', hidden: true,
    text: '키오스크 모드에서는 주소창과 창 단추가 없습니다. 끄려면 Alt+F4를 누릅니다. 학생 손이 닿는 PC에서만 쓰고, 끄는 방법을 꼭 함께 알려 두세요.' });
  const refresh = () => {
    cmd.value = commandLine({ browser: opt.browser, url, kiosk: opt.kiosk });
    kioskWarn.hidden = !opt.kiosk;
  };
  refresh();

  const fallback = h('div', { class: 'card', hidden: true, 'data-key': 'bat:manual' });
  async function save(name, text) {
    if (window.showSaveFilePicker) {
      try {
        const file = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: '배치 파일', accept: { 'application/octet-stream': ['.bat'] } }] });
        const w = await file.createWritable();
        await w.write(new Blob([text], { type: 'application/octet-stream' }));
        await w.close();
        say(`${name} 파일을 저장했습니다`);
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return say('저장을 취소했습니다');
      }
    }
    showManual(name, text);
  }
  // 저장 창을 쓸 수 없는 브라우저는 내용을 보여 주고 메모장으로 저장하게 한다 (a 요소로 내려받기는 쓰지 않는 규칙).
  function showManual(name, text) {
    const box = h('textarea', { readOnly: true, rows: 8, class: 'mono', spellcheck: false, value: text });
    fallback.replaceChildren(
      h('h4', { text: `${name} 직접 만들기` }),
      h('p', { text: '이 브라우저에서는 파일 저장 창을 열 수 없습니다. 아래 내용을 복사해 메모장에 붙여 넣고, 파일 > 다른 이름으로 저장에서 파일 형식을 모든 파일, 인코딩을 UTF-8로 고른 뒤 이름을 ' + name + ' 로 저장하세요.' }),
      field(`${name} 내용`, box, { wide: true }),
      h('div', { class: 'row-actions' }, button('내용 복사', () => copy(text, box, '내용을'), { ic: 'copy', key: 'bat:copy' })),
    );
    fallback.hidden = false;
    say(`${name} 내용을 아래에 보였습니다. 복사해서 메모장으로 저장하세요`);
    box.focus();
  }

  return h('section', { class: 'sec' }, h('h3', { text: '학급 PC 설치' }),
    h('p', { class: 'warn-box', text: '학교 PC에서는 내려받은 .bat 파일이나 PowerShell이 막혀 있을 수 있습니다. 아래 수동 설치가 기본이고, 설치 파일은 보조 방법입니다.' }),
    radios('브라우저', 'browser', [['chrome', '크롬'], ['edge', '엣지', '엣지의 옵션 동작은 아직 확인 중입니다']],
      () => opt.browser, (v) => { opt.browser = v; refresh(); say(v === 'edge' ? '엣지 명령줄로 바꿨습니다' : '크롬 명령줄로 바꿨습니다'); }),
    check('키오스크 모드 (학생 손이 닿는 PC)', () => opt.kiosk, (v) => { opt.kiosk = v; }, () => { refresh(); say(opt.kiosk ? '키오스크 명령줄로 바꿨습니다' : '전체 화면 명령줄로 바꿨습니다'); }, { key: 'kiosk' }),
    kioskWarn,
    field('바로가기 대상 (명령줄)', cmd, { wide: true, hint: '브라우저가 다른 곳에 설치되어 있으면 앞쪽 따옴표 안의 경로를 고쳐 쓰세요. 전용 프로필을 써서 크롬이 이미 열려 있어도 따로 열립니다.' }),
    h('div', { class: 'row-actions' }, button('명령줄 복사', () => copy(cmd.value, cmd, '명령줄을'), { ic: 'copy', key: 'cmd:copy' })),
    h('h4', { text: '수동 설치 (기본)' }),
    MANUAL.map((t) => h('p', { text: t })),
    h('p', { class: 'hint', text: '게시판 창은 Alt+F4로 끕니다. 수동 설치는 켜자마자 열리므로 네트워크가 늦으면 잠깐 연결 중이 보였다가 저절로 이어집니다.' }),
    h('h4', { text: '설치 파일 (보조)' }),
    h('p', { class: 'hint', text: `${INSTALL_FILE}은 크롬(없으면 엣지)을 찾아 시작프로그램과 바탕화면에 ClassBoard 바로가기를 만들고, 켤 때 25초 기다렸다가 엽니다. ${UNINSTALL_FILE}은 그것을 지웁니다. 실패하면 위 수동 설치를 따르세요.` }),
    h('div', { class: 'row-actions' },
      button('설치 파일 받기', () => save(INSTALL_FILE, installBat({ url, kiosk: opt.kiosk })), { ic: 'save', key: 'bat:install' }),
      button('제거 파일 받기', () => save(UNINSTALL_FILE, uninstallBat()), { ic: 'save', key: 'bat:uninstall' })),
    fallback,
  );
}

export function render(panel) {
  const url = boardUrl();
  const addr = h('input', { type: 'text', readOnly: true, value: url, class: 'mono', 'data-key': 'url' });
  const shared = S.shared === 'shared';
  panel.append(
    h('h2', { text: '학급 PC 연결' }),
    h('section', { class: 'sec' }, h('h3', { text: '표시 주소' }),
      field('학급 PC에서 열 주소', addr, { wide: true, hint: '이 주소를 아는 사람은 누구나 게시판을 볼 수 있습니다' }),
      h('div', { class: 'row-actions' },
        button('주소 복사', () => copy(url, addr, '주소를'), { ic: 'copy', key: 'url:copy' }),
        button('표시 화면 미리보기', () => window.open(url, '_blank', 'noopener'), { key: 'url:open' }))),
    installSection(url),
    h('section', { class: 'sec' }, h('h3', { text: '공유 상태' }),
      h('p', {}, '지금: ', h('strong', { text: shared ? '공유 중' : S.shared === 'stopped' ? '공유 중지됨' : '확인하지 못함' })),
      shared
        ? button('지금 공유 끊기', hooks.unshare, { kind: 'danger', ic: 'stop', key: 'share:stop' })
        : button('다시 공유하기', hooks.reshare, { kind: 'primary', key: 'share:again' })),
    h('section', { class: 'sec' }, h('h3', { text: '이전 버전' }),
      h('p', { class: 'hint', text: '저장할 때마다 바로 전 내용 5개를 내 드라이브에 비공개로 보관합니다.' }),
      button('이전으로 되돌리기', hooks.restore, { key: 'restore' })),
    h('section', { class: 'sec danger-zone' }, h('h3', { text: '게시판 삭제' }),
      h('p', { class: 'hint', text: '게시판 파일, 이미지, 이전 버전을 드라이브에서 영구 삭제합니다.' }),
      button('게시판 삭제', hooks.remove, { kind: 'danger', ic: 'trash', key: 'remove' })),
  );
}
