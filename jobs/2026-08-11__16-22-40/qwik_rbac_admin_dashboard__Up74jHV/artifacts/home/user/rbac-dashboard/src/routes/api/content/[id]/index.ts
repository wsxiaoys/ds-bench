import { type RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../../db';
import { getCurrentUser } from '../../../../auth';

export const onDelete: RequestHandler = async (event) => {
  const user = getCurrentUser(event);
  if (!user) {
    event.status(401);
    return event.json(401, { error: 'Unauthorized' });
  }

  if (user.role !== 'admin' && user.role !== 'editor') {
    event.status(403);
    return event.json(403, { error: 'Forbidden' });
  }

  const id = Number(event.params.id);
  if (isNaN(id)) {
    event.status(400);
    return event.json(400, { error: 'Invalid ID' });
  }

  // Check if content exists
  const existing = db.prepare('SELECT id FROM content WHERE id = ?').get(id);
  if (!existing) {
    event.status(404);
    return event.json(404, { error: 'Not Found' });
  }

  db.prepare('DELETE FROM content WHERE id = ?').run(id);
  event.status(200);
  return event.json(200, { success: true });
};
