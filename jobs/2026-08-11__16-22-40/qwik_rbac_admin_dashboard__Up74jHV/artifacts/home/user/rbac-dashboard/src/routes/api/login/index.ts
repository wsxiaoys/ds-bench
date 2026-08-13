import { type RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../db';
import { createSession } from '../../../auth';

export const onPost: RequestHandler = async (event) => {
  try {
    const body = await event.request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      event.status(401);
      return event.json(401, { error: 'Username and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user || user.password !== password) {
      event.status(401);
      return event.json(401, { error: 'Invalid credentials' });
    }

    const sessionId = createSession(user.id);
    event.cookie.set('session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });

    event.status(200);
    return event.json(200, {
      username: user.username,
      role: user.role,
    });
  } catch (err: any) {
    event.status(401);
    return event.json(401, { error: 'Invalid credentials' });
  }
};
