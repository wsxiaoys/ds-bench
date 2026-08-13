import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../lib/db';
import { createSession } from '../../../lib/session';

export const onPost: RequestHandler = async (event) => {
  const body = await event.parseBody() as any;
  const username = body?.username;
  const password = body?.password;

  if (!username || !password) {
    event.json(401, { error: 'Username and password are required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user || user.password !== password) {
    event.json(401, { error: 'Invalid credentials' });
    return;
  }

  const sessionId = createSession(user.id);
  event.cookie.set('session', sessionId, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  event.json(200, { username: user.username, role: user.role });
};
