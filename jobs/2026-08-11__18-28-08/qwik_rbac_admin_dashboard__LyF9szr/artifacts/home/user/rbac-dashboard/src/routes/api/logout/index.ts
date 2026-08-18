import type { RequestHandler } from '@builder.io/qwik-city';
import { deleteSession } from '../../../lib/session';

export const onPost: RequestHandler = async (event) => {
  const sessionCookie = event.cookie.get('session');
  if (sessionCookie) {
    deleteSession(sessionCookie.value);
    event.cookie.delete('session', { path: '/' });
  }
  event.json(200, { message: 'Logged out successfully' });
};
