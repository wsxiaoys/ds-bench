import { exec } from "child_process";
import type { RequestHandler } from "@builder.io/qwik-city";
import db from "../../../../../db";

export const onPost: RequestHandler = async (event) => {
  try {
    const id = event.params.id;

    // Check if task exists and get command
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    if (!task) {
      event.json(404, { error: `Task with id '${id}' not found` });
      return;
    }

    // Trigger execution in background (do not await)
    exec(task.command, (error) => {
      const status = error === null ? "SUCCESS" : "FAILED";
      const timestamp = new Date().toISOString();
      try {
        db.prepare(
          "INSERT INTO execution_history (task_id, status, timestamp) VALUES (?, ?, ?)"
        ).run(id, status, timestamp);
      } catch (err) {
        console.error(`[Trigger] Failed to log execution history for task ${id}:`, err);
      }
    });

    event.json(200, {
      id,
      triggered: true,
    });
  } catch (err: any) {
    event.json(500, { error: err.message });
  }
};
