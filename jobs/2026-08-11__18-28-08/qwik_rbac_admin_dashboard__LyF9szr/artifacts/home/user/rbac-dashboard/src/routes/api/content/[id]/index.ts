import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../../lib/db';

export const onDelete: RequestHandler = async (event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    event.json(401, { error: 'Unauthorized' });
    return;
  }

  if (user.role !== 'admin' && user.role !== 'editor') {
    event.json(403, { error: 'Forbidden' });
    return;
  }

  const id = Number(event.params.id);
  if (isNaN(id)) {
    event.json(400, { error: 'Invalid ID' });
    return;
  }

  // Check if content exists
  const existing = db.prepare('SELECT id FROM content WHERE id = ?').get(id);
  if (!existing) {
    event.json(404, { error: 'Content not found' });
    return;
  }

  db.prepare('DELETE FROM content WHERE id = ?').run(id);
  event.json(200, { message: 'Deleted successfully' });
};
