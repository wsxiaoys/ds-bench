import { RequestHandler } from '@builder.io/qwik-city';
import { getDb } from '../../../db';

export const onGet: RequestHandler = async (event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    event.status(401);
    event.json(401, { error: 'Unauthorized' });
    return;
  }

  try {
    const db = await getDb();
    const contents = await db.all('SELECT id, title, body FROM content');
    event.json(200, contents);
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

  if (user.role !== 'editor' && user.role !== 'admin') {
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

    const db = await getDb();
    const result = await db.run(
      'INSERT INTO content (title, body) VALUES (?, ?)',
      title,
      contentBody
    );

    event.status(201);
    event.json(201, {
      id: result.lastID,
      title,
      body: contentBody,
    });
  } catch (err) {
    event.status(500);
    event.json(500, { error: 'Internal server error' });
  }
};
