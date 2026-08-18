import type { RequestHandler } from '@builder.io/qwik-city';
import { getSession } from '../lib/session';

export const onRequest: RequestHandler = async (event) => {
  const sessionCookie = event.cookie.get('session');
  if (sessionCookie) {
    const sessionData = getSession(sessionCookie.value);
    if (sessionData) {
      event.sharedMap.set('user', sessionData.user);
      event.sharedMap.set('session', sessionData.session);
    }
  }
  await event.next();
};
