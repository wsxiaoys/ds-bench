import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../../../lib/db';
import { setTaskLastExecuted } from '../../../../../lib/runner';

export const onPost: RequestHandler = async ({ json, params }) => {
  const { id } = params;
  try {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) {
      json(404, { error: `Task with id '${id}' not found` });
      return;
    }

    db.prepare("UPDATE tasks SET status = 'ACTIVE' WHERE id = ?").run(id);

    // Reset the last executed time to the current time so it executes after interval_seconds
    setTaskLastExecuted(id, Date.now());

    json(200, {
      id,
      status: 'ACTIVE'
    });
  } catch (err: any) {
    json(500, { error: err.message });
  }
};
