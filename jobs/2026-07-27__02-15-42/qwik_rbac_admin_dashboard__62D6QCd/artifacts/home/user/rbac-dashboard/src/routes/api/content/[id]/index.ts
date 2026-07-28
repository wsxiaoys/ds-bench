import { RequestHandler } from '@builder.io/qwik-city';
import { getDb } from '../../../../db';

export const onDelete: RequestHandler = async (event) => {
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

  const id = event.params.id;
  try {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM content WHERE id = ?', id);
    if (!existing) {
      event.status(404);
      event.json(404, { error: 'Content not found' });
      return;
    }

    await db.run('DELETE FROM content WHERE id = ?', id);
    event.status(200);
    event.json(200, { message: 'Deleted successfully' });
  } catch (err) {
    event.status(500);
    event.json(500, { error: 'Internal server error' });
  }
};
