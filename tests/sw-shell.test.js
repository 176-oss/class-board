import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const shell = new Set([...read('sw.js').match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));

// index.html 에서 시작해 import·CSS url 을 따라가며 불러오는 파일을 모두 모은다.
function loaded() {
  const out = new Set();
  const queue = [...read('index.html').matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1]);
  while (queue.length) {
    const p = posix.normalize(queue.shift());
    if (out.has(p)) continue;
    out.add(p);
    const text = read(p);
    const deps = p.endsWith('.css')
      ? [...text.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1])
      : [...text.matchAll(/(?:import|from)\s*\(?\s*'(\.{1,2}\/[^']+)'/g)].map((m) => m[1]);
    for (const d of deps) queue.push(posix.join(posix.dirname(p), d));
  }
  return [...out].map((p) => './' + p);
}

test('index.html 이 불러오는 파일은 모두 SHELL 에 있다', () => {
  const files = loaded();
  assert.ok(files.includes('./js/display/main.js') && files.includes('./fonts/IBMPlexSansKR-Medium.woff2'));
  for (const f of files) assert.ok(shell.has(f), `SHELL 에 없음: ${f}`);
});

test('SHELL 파일은 모두 있고 ./ 와 ./index.html 을 포함한다', () => {
  assert.ok(shell.has('./') && shell.has('./index.html') && shell.has('./config.js'));
  for (const f of shell) if (f !== './') assert.ok(existsSync(join(ROOT, f)), `파일 없음: ${f}`);
});

test('VERSION 형식 YYYYMMDD-n', () => {
  assert.match(read('sw.js'), /const VERSION = '\d{8}-\d+';/);
});
