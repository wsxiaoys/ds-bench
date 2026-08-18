import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '../../../../../lib/db';
import { runTaskCommand, setTaskLastExecuted } from '../../../../../lib/runner';

export const onPost: RequestHandler = async ({ json, params }) => {
  const { id } = params;
  try {
    const task = db.prepare('SELECT id, command FROM tasks WHERE id = ?').get(id) as { id: string, command: string } | undefined;
    if (!task) {
      json(404, { error: `Task with id '${id}' not found` });
      return;
    }

    // Trigger in background (don't await the execution, just start it)
    runTaskCommand(task.id, task.command);

    // Update lastExecuted to now so the interval schedules from this trigger
    setTaskLastExecuted(task.id, Date.now());

    json(200, {
      id,
      triggered: true
    });
  } catch (err: any) {
    json(500, { error: err.message });
  }
};
