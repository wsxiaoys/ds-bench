import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../lib/db';

export const onPost: RequestHandler = async (event) => {
  const sessionCookie = event.cookie.get('session');
  if (sessionCookie) {
    const sessionId = sessionCookie.value;
    try {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    } catch (err) {
      console.error('Logout db error:', err);
    }
  }

  // Clear cookie
  event.cookie.delete('session', { path: '/' });

  event.status(200);
  event.json(200, { message: 'Logged out successfully' });
};
