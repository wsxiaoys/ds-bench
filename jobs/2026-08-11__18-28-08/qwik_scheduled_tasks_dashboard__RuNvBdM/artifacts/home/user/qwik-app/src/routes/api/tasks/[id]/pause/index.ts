import type { RequestHandler } from "@builder.io/qwik-city";
import db from "../../../../../db";

export const onPost: RequestHandler = async (event) => {
  try {
    const id = event.params.id;

    // Check if task exists
    const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id);
    if (!task) {
      event.json(404, { error: `Task with id '${id}' not found` });
      return;
    }

    // Update status to PAUSED
    db.prepare("UPDATE tasks SET status = 'PAUSED' WHERE id = ?").run(id);

    event.json(200, {
      id,
      status: "PAUSED",
    });
  } catch (err: any) {
    event.json(500, { error: err.message });
  }
};
