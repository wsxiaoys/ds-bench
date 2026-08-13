import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../../lib/db';

export const onGet: RequestHandler = async (event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    event.json(401, { error: 'Unauthorized' });
    return;
  }

  if (user.role !== 'admin') {
    event.json(403, { error: 'Forbidden' });
    return;
  }

  const users = db.prepare('SELECT id, username, role FROM users').all();
  event.json(200, users);
};

export const onPost: RequestHandler = async (event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    event.json(401, { error: 'Unauthorized' });
    return;
  }

  if (user.role !== 'admin') {
    event.json(403, { error: 'Forbidden' });
    return;
  }

  const body = await event.parseBody() as any;
  const username = body?.username;
  const password = body?.password;
  const role = body?.role;

  if (!username || !password || !role) {
    event.json(400, { error: 'Username, password, and role are required' });
    return;
  }

  if (role !== 'admin' && role !== 'editor' && role !== 'viewer') {
    event.json(400, { error: 'Invalid role' });
    return;
  }

  // Check if user already exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    event.json(400, { error: 'Username already exists' });
    return;
  }

  const insert = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
  const result = insert.run(username, password, role);
  const newId = Number(result.lastInsertRowid);

  event.json(201, { id: newId, username, role });
};
