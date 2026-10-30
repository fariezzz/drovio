import { randomBytes } from 'node:crypto';

export function createSessionId() {
  return randomBytes(32).toString('base64url');
}

export function isValidSessionId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function canAccessPrivateJob(ownerSessionId, requesterSessionId) {
  return isValidSessionId(ownerSessionId) && ownerSessionId === requesterSessionId;
}
