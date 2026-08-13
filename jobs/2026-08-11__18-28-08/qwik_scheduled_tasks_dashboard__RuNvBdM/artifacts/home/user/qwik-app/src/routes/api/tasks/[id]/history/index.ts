import type { RequestHandler } from "@builder.io/qwik-city";
import db from "../../../../../db";

export const onGet: RequestHandler = async (event) => {
  try {
    const id = event.params.id;

    // Check if task exists
    const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id);
    if (!task) {
      event.json(404, { error: `Task with id '${id}' not found` });
      return;
    }

    // Get history sorted by timestamp descending
    const history = db.prepare(
      "SELECT * FROM execution_history WHERE task_id = ? ORDER BY timestamp DESC"
    ).all(id);

    event.json(200, history);
  } catch (err: any) {
    event.json(500, { error: err.message });
  }
};
