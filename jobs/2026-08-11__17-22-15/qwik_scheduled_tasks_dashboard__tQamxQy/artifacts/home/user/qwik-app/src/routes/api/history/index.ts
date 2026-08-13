import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../lib/db';

export const onGet: RequestHandler = async ({ json }) => {
  try {
    const history = db.prepare(`
      SELECT h.*, t.name as task_name
      FROM execution_history h
      JOIN tasks t ON h.task_id = t.id
      ORDER BY h.timestamp DESC, h.id DESC
      LIMIT 100
    `).all();
    json(200, history);
  } catch (err: any) {
    json(500, { error: err.message });
  }
};
