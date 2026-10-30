import { NextRequest, NextResponse } from 'next/server';
import {
  canAccessPrivateJob,
  createSessionId,
  isValidSessionId,
} from './private-history-core.mjs';

export { canAccessPrivateJob, createSessionId, isValidSessionId } from './private-history-core.mjs';

export const PRIVATE_SESSION_COOKIE = 'drovio_session';
export const PRIVATE_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function getOrCreateSessionId(req: NextRequest): {
  sessionId: string;
  isNew: boolean;
} {
  const existing = req.cookies.get(PRIVATE_SESSION_COOKIE)?.value;
  if (typeof existing === 'string' && isValidSessionId(existing)) {
    return { sessionId: existing, isNew: false };
  }

  return { sessionId: createSessionId(), isNew: true };
}

export function setPrivateSessionCookie(
  response: NextResponse,
  sessionId: string,
  secure = process.env.NODE_ENV === 'production'
): void {
  response.cookies.set({
    name: PRIVATE_SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: PRIVATE_SESSION_MAX_AGE,
  });
}
