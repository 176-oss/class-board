// 학급 PC 연결 탭: 표시 주소, 미리보기, 공유 상태, 되돌리기, 삭제. 설치 안내는 설치 단계에서 채운다.
import { S, hooks } from './state.js';
import { h, field, button, say } from './ui.js';
import { displayUrl } from '../core/install.js';

export const boardUrl = () => displayUrl(new URL('./', location.href).href, S.fileId);

export function render(panel) {
  const url = boardUrl();
  const addr = h('input', { type: 'text', readOnly: true, value: url, class: 'mono', 'data-key': 'url' });
  const shared = S.shared === 'shared';
  panel.append(
    h('h2', { text: '학급 PC 연결' }),
    h('section', { class: 'sec' }, h('h3', { text: '표시 주소' }),
      field('학급 PC에서 열 주소', addr, { wide: true, hint: '이 주소를 아는 사람은 누구나 게시판을 볼 수 있습니다' }),
      h('div', { class: 'row-actions' },
        button('주소 복사', async () => {
          try {
            await navigator.clipboard.writeText(url);
            say('주소를 복사했습니다');
          } catch {
            addr.select();
            say('주소를 골라 두었습니다. Ctrl+C로 복사하세요');
          }
        }, { ic: 'copy', key: 'url:copy' }),
        button('표시 화면 미리보기', () => window.open(url, '_blank', 'noopener'), { key: 'url:open' }))),
    h('section', { class: 'sec' }, h('h3', { text: '설치' }),
      h('p', { class: 'hint', text: '학급 PC 설치 파일과 순서는 준비 중입니다. 지금은 위 주소를 학급 PC 브라우저에서 열어 전체 화면(F11)으로 씁니다.' })),
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
