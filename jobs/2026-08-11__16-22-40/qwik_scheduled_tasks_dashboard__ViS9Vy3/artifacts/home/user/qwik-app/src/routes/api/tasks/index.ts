import type { RequestHandler } from "@builder.io/qwik-city";
import db from "../../../lib/db";

export const onGet: RequestHandler = async ({ json }) => {
  try {
    const tasks = db.prepare("SELECT * FROM tasks").all();
    json(200, tasks);
  } catch (err: any) {
    json(500, { error: err.message });
  }
};

export const onPost: RequestHandler = async ({ parseBody, json }) => {
  try {
    const body = await parseBody() as any;
    const validation = validateTask(body);
    if (!validation.valid) {
      json(400, { error: validation.error });
      return;
    }

    const { id, name, command, interval_seconds, status } = body;

    // Check if task already exists
    const existing = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id);
    if (existing) {
      json(400, { error: `Task with id '${id}' already exists` });
      return;
    }

    // Insert task
    const stmt = db.prepare(
      "INSERT INTO tasks (id, name, command, interval_seconds, status) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(id, name, command, interval_seconds, status);

    json(201, { id, name, command, interval_seconds, status });
  } catch (err: any) {
    json(500, { error: err.message });
  }
};

function validateTask(body: any) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }
  const { id, name, command, interval_seconds, status } = body;
  if (typeof id !== 'string' || !id.trim()) {
    return { valid: false, error: 'id is required and must be a non-empty string' };
  }
  if (typeof name !== 'string' || !name.trim()) {
    return { valid: false, error: 'name is required and must be a non-empty string' };
  }
  if (typeof command !== 'string' || !command.trim()) {
    return { valid: false, error: 'command is required and must be a non-empty string' };
  }
  if (typeof interval_seconds !== 'number' || isNaN(interval_seconds) || interval_seconds <= 0 || !Number.isInteger(interval_seconds)) {
    return { valid: false, error: 'interval_seconds is required and must be an integer greater than 0' };
  }
  if (status !== 'ACTIVE' && status !== 'PAUSED') {
    return { valid: false, error: "status is required and must be either 'ACTIVE' or 'PAUSED'" };
  }
  return { valid: true };
}
