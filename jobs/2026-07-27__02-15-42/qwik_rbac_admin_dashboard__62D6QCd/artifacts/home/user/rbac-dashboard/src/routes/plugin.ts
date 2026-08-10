import { RequestHandler } from '@builder.io/qwik-city';
import { getDb } from '../db';

export const onRequest: RequestHandler = async (event) => {
  const sessionCookie = event.cookie.get('session');
  if (sessionCookie) {
    const sessionId = sessionCookie.value;
    try {
      const db = await getDb();
      const sessionUser = await db.get<{ id: number; username: string; role: string }>(
        `SELECT u.id, u.username, u.role FROM sessions s 
         JOIN users u ON s.user_id = u.id 
         WHERE s.id = ?`,
        sessionId
      );
      if (sessionUser) {
        event.sharedMap.set('user', sessionUser);
      }
    } catch (err) {
      console.error('Error resolving session:', err);
    }
  }
};
