import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../lib/db';
import crypto from 'crypto';

export const onPost: RequestHandler = async (event) => {
  try {
    const body = await event.request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      event.status(401);
      event.json(401, { error: 'Username and password are required' });
      return;
    }

    // Lookup user
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!user || user.password !== password) {
      event.status(401);
      event.json(401, { error: 'Invalid credentials' });
      return;
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const createdAt = Date.now();

    db.prepare('INSERT INTO sessions (id, userId, createdAt) VALUES (?, ?, ?)').run(
      sessionId,
      user.id,
      createdAt
    );

    // Set cookie
    event.cookie.set('session', sessionId, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: false, // since we are running locally, secure can be false
    });

    event.status(200);
    event.json(200, {
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    console.error('Login error:', err);
    event.status(401);
    event.json(401, { error: 'Invalid request' });
  }
};
