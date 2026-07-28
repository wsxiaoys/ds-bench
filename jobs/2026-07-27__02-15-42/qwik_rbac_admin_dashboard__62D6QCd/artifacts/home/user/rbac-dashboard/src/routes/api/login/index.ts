import { RequestHandler } from '@builder.io/qwik-city';
import { getDb } from '../../../db';
import { randomUUID } from 'crypto';

export const onPost: RequestHandler = async (event) => {
  try {
    const body = await event.request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      event.status(401);
      event.json(401, { error: 'Invalid credentials' });
      return;
    }

    const db = await getDb();
    const user = await db.get<{ id: number; username: string; password?: string; role: string }>(
      'SELECT id, username, password, role FROM users WHERE username = ?',
      username
    );

    if (!user || user.password !== password) {
      event.status(401);
      event.json(401, { error: 'Invalid credentials' });
      return;
    }

    const sessionId = randomUUID();
    await db.run('INSERT INTO sessions (id, user_id) VALUES (?, ?)', sessionId, user.id);

    event.cookie.set('session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });

    event.json(200, {
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    event.status(401);
    event.json(401, { error: 'Invalid credentials' });
  }
};
