// 학급 PC 연결 (계약 11절). 명령줄과 설치 파일은 설치 단계에서 이 파일에 더한다.
import { isValidFileId } from './ids.js';

export function displayUrl(base, fileId) {
  if (!isValidFileId(fileId)) throw new TypeError('파일 ID 형식이 아닙니다');
  return `${base}?f=${encodeURIComponent(fileId)}`;
}
