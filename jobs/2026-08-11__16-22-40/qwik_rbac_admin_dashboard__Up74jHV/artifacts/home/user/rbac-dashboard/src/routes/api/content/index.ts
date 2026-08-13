import { type RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../db';
import { getCurrentUser } from '../../../auth';

export const onGet: RequestHandler = async (event) => {
  const user = getCurrentUser(event);
  if (!user) {
    event.status(401);
    return event.json(401, { error: 'Unauthorized' });
  }

  const content = db.prepare('SELECT id, title, body FROM content').all();
  event.status(200);
  return event.json(200, content);
};

export const onPost: RequestHandler = async (event) => {
  const user = getCurrentUser(event);
  if (!user) {
    event.status(401);
    return event.json(401, { error: 'Unauthorized' });
  }

  if (user.role !== 'admin' && user.role !== 'editor') {
    event.status(403);
    return event.json(403, { error: 'Forbidden' });
  }

  try {
    const body = await event.request.json();
    const { title, body: contentBody } = body || {};

    if (!title || !contentBody) {
      event.status(400);
      return event.json(400, { error: 'Title and body are required' });
    }

    const info = db.prepare('INSERT INTO content (title, body) VALUES (?, ?)').run(title, contentBody);
    const createdId = Number(info.lastInsertRowid);

    event.status(201);
    return event.json(201, {
      id: createdId,
      title,
      body: contentBody,
    });
  } catch (err: any) {
    event.status(400);
    return event.json(400, { error: 'Invalid request' });
  }
};
