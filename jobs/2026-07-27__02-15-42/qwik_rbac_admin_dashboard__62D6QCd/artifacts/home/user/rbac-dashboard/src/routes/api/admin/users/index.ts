import { RequestHandler } from '@builder.io/qwik-city';
import { getDb } from '../../../../db';

export const onGet: RequestHandler = async (event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    event.status(401);
    event.json(401, { error: 'Unauthorized' });
    return;
  }

  if (user.role !== 'admin') {
    event.status(403);
    event.json(403, { error: 'Forbidden' });
    return;
  }

  try {
    const db = await getDb();
    const users = await db.all('SELECT id, username, role FROM users');
    event.json(200, users);
  } catch (err) {
    event.status(500);
    event.json(500, { error: 'Internal server error' });
  }
};

export const onPost: RequestHandler = async (event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    event.status(401);
    event.json(401, { error: 'Unauthorized' });
    return;
  }

  if (user.role !== 'admin') {
    event.status(403);
    event.json(403, { error: 'Forbidden' });
    return;
  }

  try {
    const body = await event.request.json();
    const { username, password, role } = body || {};

    if (!username || !password || !role) {
      event.status(400);
      event.json(400, { error: 'Username, password and role are required' });
      return;
    }

    if (role !== 'admin' && role !== 'editor' && role !== 'viewer') {
      event.status(400);
      event.json(400, { error: 'Invalid role' });
      return;
    }

    const db = await getDb();
    
    // Check if user already exists
    const existing = await db.get('SELECT id FROM users WHERE username = ?', username);
    if (existing) {
      event.status(400);
      event.json(400, { error: 'Username already exists' });
      return;
    }

    const result = await db.run(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      username,
      password,
      role
    );

    event.status(201);
    event.json(201, {
      id: result.lastID,
      username,
      role,
    });
  } catch (err) {
    event.status(500);
    event.json(500, { error: 'Internal server error' });
  }
};
