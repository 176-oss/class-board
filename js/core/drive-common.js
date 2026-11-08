// 드라이브 주소, 범위, 오류 분류, 화면 문구 (계약 5-1, 5-3, 6, 9절).
import { isValidFileId } from './ids.js';

export const API = 'https://www.googleapis.com/drive/v3/files';
export const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export const DOWNLOAD = 'https://www.googleapis.com/download/drive/v3/files';
// drive.appdata는 이력을 appDataFolder에 두기 위해 필요하다.
export const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata';

export const ADMIN_MESSAGES = {
  network: '인터넷 연결을 확인하세요. 저장되지 않았습니다',
  networkRead: '인터넷 연결을 확인하세요',
  rateLimit: '구글 드라이브가 잠시 바쁩니다. 1분 뒤 다시 해 주세요',
  auth: '구글 로그인이 만료되었습니다. 다시 로그인하세요',
  shareBlocked: '이 계정은 링크 공유가 허용되지 않습니다. 개인 구글 계정으로 로그인하세요',
  forbidden: '이 파일에 접근할 권한이 없습니다. 게시판을 만든 계정으로 로그인했는지 확인하세요',
  notFound: '드라이브에서 게시판 파일을 찾지 못했습니다. 삭제되었거나 공유가 끊겼을 수 있습니다',
  invalid: '게시판 파일 내용이 올바르지 않습니다',
  loginDenied: '이 구글 계정으로는 로그인할 수 없습니다. 학교 계정은 외부 앱이 막혀 있을 수 있으니 개인 구글 계정으로 로그인하세요',
  loginPopup: '구글 로그인 창을 열지 못했습니다. 팝업 차단을 확인하세요',
  loginScopes: '권한 상자를 모두 체크해야 합니다. 다시 로그인하세요',
  shareUnconfirmed: '공유를 확인하지 못했습니다. 다시 만들어 주세요',
};

export const DISPLAY_TEXT = {
  connecting: '연결 중',
  connectingSub: '잠시 뒤 다시 시도합니다',
  badAddress: '주소 오류',
  badAddressSub: '학급 PC 연결 주소를 다시 확인하세요',
  needKey: '설정이 필요합니다. config.js에 DRIVE_API_KEY를 넣어 주세요',
  stalePrefix: '마지막 갱신 ',
  days: '며칠째 갱신되지 않음',
  clockSkew: '이 PC의 시계를 확인하세요',
  needsUpdate: '화면 업데이트 필요',
  readFailed: '내용을 읽지 못해 이전 내용을 표시합니다',
  forbidden: '연결 설정을 확인하세요',
  fakeMode: '가짜 드라이브 모드',
};

const KINDS = ['network', 'rateLimit', 'auth', 'shareBlocked', 'forbidden', 'notFound', 'invalid'];

// 토큰·키·응답 본문은 넣지 않는다. 문구는 kind로만 정해진다.
export class DriveError extends Error {
  constructor(kind, { status = null } = {}) {
    const k = KINDS.includes(kind) ? kind : 'invalid';
    super(ADMIN_MESSAGES[k]);
    this.name = 'DriveError';
    this.kind = k;
    this.status = status;
  }
}

const RATE_REASONS = ['rateLimitExceeded', 'userRateLimitExceeded', 'downloadQuotaExceeded'];

// status 가 없으면(fetch 예외, 시간 초과, JSON 아닌 응답) network.
export function classifyDriveError({ status = null, body = null, op = 'read' } = {}) {
  if (!status) return 'network';
  const reasons = (body?.error?.errors ?? []).map((e) => e?.reason);
  if ((status === 403 && reasons.some((r) => RATE_REASONS.includes(r))) || status === 429 || status >= 500) return 'rateLimit';
  if (status === 401) return 'auth';
  if (op === 'share' && (status === 403 || status === 400)) return 'shareBlocked';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  return 'invalid';
}

function checkedId(fileId) {
  if (!isValidFileId(fileId)) throw new DriveError('invalid');
  return encodeURIComponent(fileId);
}

const keyPart = (key) => (key ? `&key=${encodeURIComponent(key)}` : '');

export function metaUrl(fileId, key = '') {
  return `${API}/${checkedId(fileId)}?fields=version,modifiedTime${keyPart(key)}`;
}

export function mediaUrl(fileId, key = '') {
  return `${DOWNLOAD}/${checkedId(fileId)}?alt=media${keyPart(key)}`;
}

// 배포 주소에서는 ?dev=1 이어도 켜지지 않는다 (가짜 데이터가 배포 출처에 써지지 않게).
export function isFakeMode({ hostname = '', search = '' } = {}) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) && new URLSearchParams(search).get('dev') !== '0';
}
