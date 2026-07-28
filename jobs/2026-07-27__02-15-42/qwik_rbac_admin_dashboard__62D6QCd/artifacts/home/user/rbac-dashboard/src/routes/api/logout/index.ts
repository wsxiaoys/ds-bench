import { RequestHandler } from '@builder.io/qwik-city';
import { getDb } from '../../../db';

export const onPost: RequestHandler = async (event) => {
  const sessionCookie = event.cookie.get('session');
  if (sessionCookie) {
    const sessionId = sessionCookie.value;
    try {
      const db = await getDb();
      await db.run('DELETE FROM sessions WHERE id = ?', sessionId);
    } catch (err) {
      console.error('Error invalidating session:', err);
    }
    event.cookie.delete('session', { path: '/' });
  }
  event.json(200, { message: 'Logged out successfully' });
};
