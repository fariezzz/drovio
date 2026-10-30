import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionId,
  isValidSessionId,
  canAccessPrivateJob,
} from '../src/lib/private-history-core.mjs';

test('Sesi privat menghasilkan ID acak dengan format valid', () => {
  const first = createSessionId();
  const second = createSessionId();

  assert.equal(isValidSessionId(first), true);
  assert.equal(first.length, 43);
  assert.notEqual(first, second);
});

test('Riwayat hanya dapat diakses oleh sesi pemilik pekerjaan', () => {
  const owner = createSessionId();
  const other = createSessionId();

  assert.equal(canAccessPrivateJob(owner, owner), true);
  assert.equal(canAccessPrivateJob(owner, other), false);
  assert.equal(canAccessPrivateJob(undefined, owner), false);
  assert.equal(canAccessPrivateJob(owner, undefined), false);
});
