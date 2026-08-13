import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../lib/db';

export const onGet: RequestHandler = async (event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    event.status(401);
    event.json(401, { error: 'Unauthorized' });
    return;
  }

  try {
    const contentList = db.prepare('SELECT id, title, body FROM content ORDER BY id ASC').all();
    event.status(200);
    event.json(200, contentList);
  } catch (err) {
    console.error('Fetch content error:', err);
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

  if (user.role !== 'admin' && user.role !== 'editor') {
    event.status(403);
    event.json(403, { error: 'Forbidden' });
    return;
  }

  try {
    const body = await event.request.json();
    const { title, body: contentBody } = body || {};

    if (!title || !contentBody) {
      event.status(400);
      event.json(400, { error: 'Title and body are required' });
      return;
    }

    // Insert new content. Note: Server assigns id, ignore any client-supplied id.
    const result = db.prepare('INSERT INTO content (title, body) VALUES (?, ?)').run(title, contentBody);
    const newId = result.lastInsertRowid;

    event.status(201);
    event.json(201, {
      id: Number(newId),
      title,
      body: contentBody,
    });
  } catch (err) {
    console.error('Create content error:', err);
    event.status(400);
    event.json(400, { error: 'Invalid request' });
  }
};
