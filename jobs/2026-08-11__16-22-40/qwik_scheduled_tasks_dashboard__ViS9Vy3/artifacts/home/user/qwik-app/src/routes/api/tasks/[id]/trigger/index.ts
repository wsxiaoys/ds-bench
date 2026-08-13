import type { RequestHandler } from "@builder.io/qwik-city";
import db from "../../../../../lib/db";
import { executeTask } from "../../../../../lib/runner";

export const onPost: RequestHandler = async ({ params, json }) => {
  const { id } = params;
  try {
    const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id);
    if (!task) {
      json(404, { error: `Task with id '${id}' not found` });
      return;
    }

    // Trigger execution in the background
    executeTask(id);

    json(200, {
      id,
      triggered: true
    });
  } catch (err: any) {
    json(500, { error: err.message });
  }
};
