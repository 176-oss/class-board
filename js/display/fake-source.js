// 가짜 드라이브 모드의 읽기 쪽 (계약 6절). 입력 화면(js/fake-store.js)이 쓰는 같은 키를 읽기만 한다.
import { DriveError } from '../core/drive-common.js';
import { isValidFileId } from '../core/ids.js';

export const FAKE_INDEX = 'classboard:fake:index';
export const FAKE_TEXT = 'classboard:fake:text:';
export const FAKE_IMG_CACHE = 'classboard:fake:img';
export const fakeImgKey = (id) => './__fake/' + id;

export function readIndex() {
  try {
    const v = JSON.parse(localStorage.getItem(FAKE_INDEX));
    return v && typeof v.files === 'object' && v.files ? v : { files: {} };
  } catch {
    return { files: {} };
  }
}

// 진짜와 같게 링크 공유가 없으면 404.
function sharedFile(id) {
  if (!isValidFileId(id)) throw new DriveError('invalid');
  const f = readIndex().files[id];
  const shared = f && (f.perms ?? []).some((p) => p.type === 'anyone' && p.role === 'reader');
  if (!shared) throw new DriveError('notFound', { status: 404 });
  return f;
}

export function createFakeSource() {
  return {
    async getMeta(id) {
      const f = sharedFile(id);
      return { version: String(f.version), modifiedTime: f.modifiedTime };
    },
    async getText(id) {
      sharedFile(id);
      const t = localStorage.getItem(FAKE_TEXT + id);
      if (t === null) throw new DriveError('notFound', { status: 404 });
      return t;
    },
    async getImage(id) {
      sharedFile(id);
      const res = await (await caches.open(FAKE_IMG_CACHE)).match(fakeImgKey(id));
      if (!res) throw new DriveError('notFound', { status: 404 });
      return res.blob();
    },
  };
}
