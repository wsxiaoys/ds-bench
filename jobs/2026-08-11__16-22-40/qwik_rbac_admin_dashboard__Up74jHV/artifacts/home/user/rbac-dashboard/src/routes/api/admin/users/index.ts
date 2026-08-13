import { type RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../../db';
import { getCurrentUser } from '../../../../auth';

export const onGet: RequestHandler = async (event) => {
  const user = getCurrentUser(event);
  if (!user) {
    event.status(401);
    return event.json(401, { error: 'Unauthorized' });
  }

  if (user.role !== 'admin') {
    event.status(403);
    return event.json(403, { error: 'Forbidden' });
  }

  const users = db.prepare('SELECT id, username, role FROM users').all();
  event.status(200);
  return event.json(200, users);
};

export const onPost: RequestHandler = async (event) => {
  const user = getCurrentUser(event);
  if (!user) {
    event.status(401);
    return event.json(401, { error: 'Unauthorized' });
  }

  if (user.role !== 'admin') {
    event.status(403);
    return event.json(403, { error: 'Forbidden' });
  }

  try {
    const body = await event.request.json();
    const { username, password, role } = body || {};

    if (!username || !password || !role) {
      event.status(400);
      return event.json(400, { error: 'Username, password and role are required' });
    }

    if (role !== 'admin' && role !== 'editor' && role !== 'viewer') {
      event.status(400);
      return event.json(400, { error: 'Role must be admin, editor, or viewer' });
    }

    // Check if username already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      event.status(400);
      return event.json(400, { error: 'Username already exists' });
    }

    const info = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, password, role);
    const createdId = Number(info.lastInsertRowid);

    event.status(201);
    return event.json(201, {
      id: createdId,
      username,
      role,
    });
  } catch (err: any) {
    event.status(400);
    return event.json(400, { error: 'Invalid request' });
  }
};
