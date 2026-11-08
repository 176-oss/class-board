// 로그인 없는 공개 키 읽기 (계약 5-5 DisplaySource). 실패는 모두 DriveError.
import { DriveError, classifyDriveError, metaUrl, mediaUrl } from '../core/drive-common.js';

const TIMEOUT_MS = 30000;

// 본문을 다 읽을 때까지 시간 제한을 건다 (느린 학교 망에서 응답 머리만 오고 멈추는 경우).
async function get(url, read) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    let res;
    try {
      res = await fetch(url, { cache: 'no-store', signal: ctl.signal });
    } catch {
      throw new DriveError('network');
    }
    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch { /* 본문 없음 */ }
      throw new DriveError(classifyDriveError({ status: res.status, body, op: 'read' }), { status: res.status });
    }
    try {
      return await read(res);
    } catch {
      throw new DriveError('network');
    }
  } finally {
    clearTimeout(timer);
  }
}

export function createKeySource({ apiKey }) {
  return {
    async getMeta(fileId) {
      const j = await get(metaUrl(fileId, apiKey), (r) => r.json());
      return { version: String(j.version), modifiedTime: j.modifiedTime };
    },
    getText: (fileId) => get(mediaUrl(fileId, apiKey), (r) => r.text()),
    getImage: (fileId) => get(mediaUrl(fileId, apiKey), (r) => r.blob()),
  };
}
