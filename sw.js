// 표시 화면 서비스 워커 (계약 8절). SHELL 파일이나 config.js 를 바꾸는 커밋은 VERSION 을 반드시 올린다.
const VERSION = '20261109-4';
const CACHE = 'classboard:shell:' + VERSION;
const SHELL = [
  './',
  './index.html',
  './config.js',
  './css/tokens.css',
  './css/board.css',
  './js/display/main.js',
  './js/display/render.js',
  './js/display/source.js',
  './js/display/fake-source.js',
  './js/display/images.js',
  './js/display/dev-seed.js',
  './js/core/drive-common.js',
  './js/core/duty.js',
  './js/core/events.js',
  './js/core/ids.js',
  './js/core/net.js',
  './js/core/notices.js',
  './js/core/palette.js',
  './js/core/privacy.js',
  './js/core/schema.js',
  './js/core/time.js',
  './js/core/timetable.js',
  './fonts/IBMPlexSansKR-Regular.woff2',
  './fonts/IBMPlexSansKR-Medium.woff2',
  './fonts/IBMPlexSansKR-SemiBold.woff2',
];
const SHELL_URLS = new Set(SHELL.map((u) => new URL(u, self.location).href));
const INDEX_URL = new URL('./index.html', self.location).href;
const ROOT_PATH = new URL('./', self.location).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// 같은 출처의 다른 앱 캐시는 건드리지 않는다.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('classboard:shell:') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function fromShell(req, key) {
  const hit = await (await caches.open(CACHE)).match(key);
  return hit || fetch(req);
}

// admin.html, sw.js, 구글 API 등 SHELL 밖의 요청은 손대지 않는다.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' && (url.pathname === ROOT_PATH || url.pathname === ROOT_PATH + 'index.html')) {
    event.respondWith(fromShell(req, INDEX_URL));
    return;
  }
  if (SHELL_URLS.has(req.url)) event.respondWith(fromShell(req, req));
});
