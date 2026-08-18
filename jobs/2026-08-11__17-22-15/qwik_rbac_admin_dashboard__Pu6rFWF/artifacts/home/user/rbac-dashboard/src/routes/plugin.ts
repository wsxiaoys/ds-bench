import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../lib/db';

export const onRequest: RequestHandler = async (event) => {
  const sessionCookie = event.cookie.get('session');
  if (sessionCookie) {
    const sessionId = sessionCookie.value;
    try {
      const sessionData = db.prepare(`
        SELECT s.id as sessionId, u.id as userId, u.username, u.role
        FROM sessions s
        JOIN users u ON s.userId = u.id
        WHERE s.id = ?
      `).get(sessionId) as { sessionId: string; userId: number; username: string; role: string } | undefined;

      if (sessionData) {
        event.sharedMap.set('user', {
          id: sessionData.userId,
          username: sessionData.username,
          role: sessionData.role,
        });
      }
    } catch (err) {
      console.error('Error fetching session in middleware:', err);
    }
  }
  await event.next();
};
