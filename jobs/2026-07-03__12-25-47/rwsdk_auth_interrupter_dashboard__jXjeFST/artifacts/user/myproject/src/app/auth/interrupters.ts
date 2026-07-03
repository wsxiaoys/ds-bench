// Per-route middleware (interrupter) for RedwoodSDK.
// Interrupters are placed before the final handler in `route(path, [interrupter, handler])`.
import type { RequestInfo } from 'rwsdk/router';
import {
  readSessionCookie,
  verifySessionToken,
  buildClearSessionCookie,
} from './session';

export type AuthedRequestInfo = RequestInfo & {
  ctx: { username?: string };
};

export const isAuthenticated = async (
  requestInfo: AuthedRequestInfo,
): Promise<Response | void> => {
  const token = readSessionCookie(requestInfo.request);
  if (!token) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login' },
    });
  }
  const username = await verifySessionToken(token);
  if (!username) {
    // Invalid/tampered cookie -> clear it and redirect.
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/login',
        'Set-Cookie': buildClearSessionCookie(),
      },
    });
  }
  // Make the username available to downstream handlers via ctx.
  requestInfo.ctx.username = username;
};
