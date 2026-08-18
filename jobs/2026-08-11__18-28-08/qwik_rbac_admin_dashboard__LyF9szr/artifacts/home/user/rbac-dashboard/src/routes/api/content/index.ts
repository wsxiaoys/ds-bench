import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../lib/db';

export const onGet: RequestHandler = async (event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    event.json(401, { error: 'Unauthorized' });
    return;
  }

  const contents = db.prepare('SELECT id, title, body FROM content').all();
  event.json(200, contents);
};

export const onPost: RequestHandler = async (event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    event.json(401, { error: 'Unauthorized' });
    return;
  }

  if (user.role !== 'admin' && user.role !== 'editor') {
    event.json(403, { error: 'Forbidden' });
    return;
  }

  const body = await event.parseBody() as any;
  const title = body?.title;
  const bodyText = body?.body;

  if (!title || !bodyText) {
    event.json(400, { error: 'Title and body are required' });
    return;
  }

  const insert = db.prepare('INSERT INTO content (title, body) VALUES (?, ?)');
  const result = insert.run(title, bodyText);
  const newId = Number(result.lastInsertRowid);

  event.json(201, { id: newId, title, body: bodyText });
};
