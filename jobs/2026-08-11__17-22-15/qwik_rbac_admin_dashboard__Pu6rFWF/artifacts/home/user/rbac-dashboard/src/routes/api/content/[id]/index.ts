import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../../lib/db';

export const onDelete: RequestHandler = async (event) => {
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

  const idStr = event.params.id;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    event.status(400);
    event.json(400, { error: 'Invalid ID' });
    return;
  }

  try {
    // Check if it exists
    const content = db.prepare('SELECT id FROM content WHERE id = ?').get(id);
    if (!content) {
      event.status(404);
      event.json(404, { error: 'Content not found' });
      return;
    }

    // Delete
    db.prepare('DELETE FROM content WHERE id = ?').run(id);

    event.status(200);
    event.json(200, { message: 'Content deleted successfully' });
  } catch (err) {
    console.error('Delete content error:', err);
    event.status(500);
    event.json(500, { error: 'Internal Server Error' });
  }
};
