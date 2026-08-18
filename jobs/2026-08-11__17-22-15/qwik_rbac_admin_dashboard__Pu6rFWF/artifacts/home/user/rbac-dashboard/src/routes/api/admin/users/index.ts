import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../../lib/db';

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
    const usersList = db.prepare('SELECT id, username, role FROM users ORDER BY id ASC').all();
    event.status(200);
    event.json(200, usersList);
  } catch (err) {
    console.error('Fetch users error:', err);
    event.status(500);
    event.json(500, { error: 'Internal Server Error' });
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
      event.json(400, { error: 'Username, password, and role are required' });
      return;
    }

    if (role !== 'admin' && role !== 'editor' && role !== 'viewer') {
      event.status(400);
      event.json(400, { error: 'Invalid role. Must be one of admin, editor, viewer' });
      return;
    }

    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      event.status(400);
      event.json(400, { error: 'Username already exists' });
      return;
    }

    // Insert user
    const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
      username,
      password,
      role
    );
    const newId = result.lastInsertRowid;

    event.status(201);
    event.json(201, {
      id: Number(newId),
      username,
      role,
    });
  } catch (err) {
    console.error('Create user error:', err);
    event.status(400);
    event.json(400, { error: 'Invalid request' });
  }
};
