import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metaUrl, mediaUrl, classifyDriveError, DriveError, ADMIN_MESSAGES, isFakeMode, SCOPES } from '../js/core/drive-common.js';

const ID = 'Ab_-0123456789abcdefgh';

test('주소: 본문은 download 주소, 키는 인코딩', () => {
  assert.equal(metaUrl(ID), `https://www.googleapis.com/drive/v3/files/${ID}?fields=version,modifiedTime`);
  assert.equal(mediaUrl(ID, 'k&y'), `https://www.googleapis.com/download/drive/v3/files/${ID}?alt=media&key=k%26y`);
});

test('주소: 잘못된 파일 ID 는 invalid 를 던진다', () => {
  for (const bad of ['../x', 'a'.repeat(19), 'a b'.repeat(10), '<script>', undefined]) {
    assert.throws(() => metaUrl(bad), (e) => e instanceof DriveError && e.kind === 'invalid');
    assert.throws(() => mediaUrl(bad), (e) => e instanceof DriveError && e.kind === 'invalid');
  }
});

test('classifyDriveError: 위에서부터 먼저 맞는 것', () => {
  const rate = { error: { code: 403, errors: [{ reason: 'userRateLimitExceeded' }] } };
  assert.equal(classifyDriveError({ status: null }), 'network');
  assert.equal(classifyDriveError({ status: 403, body: rate, op: 'share' }), 'rateLimit');
  assert.equal(classifyDriveError({ status: 429 }), 'rateLimit');
  assert.equal(classifyDriveError({ status: 503 }), 'rateLimit');
  assert.equal(classifyDriveError({ status: 401 }), 'auth');
  assert.equal(classifyDriveError({ status: 403, op: 'share' }), 'shareBlocked');
  assert.equal(classifyDriveError({ status: 400, op: 'share' }), 'shareBlocked');
  assert.equal(classifyDriveError({ status: 403, op: 'read' }), 'forbidden');
  assert.equal(classifyDriveError({ status: 404 }), 'notFound');
  assert.equal(classifyDriveError({ status: 400, op: 'write' }), 'invalid');
});

test('DriveError: 문구는 kind 로만, 모르는 kind 는 invalid', () => {
  const e = new DriveError('auth', { status: 401 });
  assert.equal(e.message, ADMIN_MESSAGES.auth);
  assert.equal(e.status, 401);
  assert.equal(new DriveError('???').kind, 'invalid');
});

test('isFakeMode', () => {
  assert.equal(isFakeMode({ hostname: 'localhost', search: '' }), true);
  assert.equal(isFakeMode({ hostname: '127.0.0.1', search: '?f=x' }), true);
  assert.equal(isFakeMode({ hostname: '[::1]', search: '' }), true);
  assert.equal(isFakeMode({ hostname: 'localhost', search: '?dev=1' }), true);
  assert.equal(isFakeMode({ hostname: 'board.localhost', search: '' }), false);
  assert.equal(isFakeMode({ hostname: 'localhost', search: '?dev=0' }), false);
  assert.equal(isFakeMode({ hostname: '176-oss.github.io', search: '' }), false);
  assert.equal(isFakeMode({ hostname: '176-oss.github.io', search: '?dev=1' }), false);
  assert.equal(isFakeMode({ hostname: '176-oss.github.io', search: '?dev=1&seed=worst' }), false);
  assert.equal(isFakeMode({ hostname: 'localhost.evil.com', search: '' }), false);
});

test('SCOPES 는 drive.file + drive.appdata', () => {
  assert.equal(SCOPES, 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata');
});
