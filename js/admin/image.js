// 그림을 canvas 로 다시 그려 JPEG 로 만든다 (계약 10-2 이미지). 다시 그리면 EXIF(위치 정보 등)가 남지 않는다.
import { fitSize } from '../core/image-fit.js';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 500 * 1024;

const toBlob = (canvas, q) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));

export async function toJpeg(file) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('JPEG, PNG, WebP 그림만 올릴 수 있습니다');
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('그림을 읽지 못했습니다. 다른 파일을 골라 주세요');
  }
  let max = 1600;
  try {
    for (;;) {
      const { w, h } = fitSize(bmp.width, bmp.height, max);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      // 투명한 PNG 가 JPEG 에서 검게 되지 않게 흰 바탕을 먼저 칠한다.
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, w, h);
      g.drawImage(bmp, 0, 0, w, h);
      for (let q = 85; q >= 50; q -= 5) {
        const blob = await toBlob(c, q / 100);
        if (blob && blob.size <= MAX_BYTES) return { blob, w, h };
      }
      if (max <= 64) throw new Error('그림을 500KB 이하로 줄이지 못했습니다');
      max = Math.floor(Math.max(w, h) * 0.8);
    }
  } finally {
    bmp.close?.();
  }
}
