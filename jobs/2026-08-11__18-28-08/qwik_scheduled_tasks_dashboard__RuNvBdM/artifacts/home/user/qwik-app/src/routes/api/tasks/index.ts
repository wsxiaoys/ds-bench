import type { RequestHandler } from "@builder.io/qwik-city";
import db from "../../../db";

export const onGet: RequestHandler = async (event) => {
  try {
    const tasks = db.prepare("SELECT * FROM tasks").all();
    event.json(200, tasks);
  } catch (err: any) {
    event.json(500, { error: err.message });
  }
};

export const onPost: RequestHandler = async (event) => {
  try {
    let body: any;
    try {
      body = await event.request.json();
    } catch {
      event.json(400, { error: "Invalid JSON in request body" });
      return;
    }

    const { id, name, command, interval_seconds, status } = body || {};

    // Validation
    if (typeof id !== "string" || !id.trim()) {
      event.json(400, { error: "id must be a non-empty string" });
      return;
    }
    if (typeof name !== "string" || !name.trim()) {
      event.json(400, { error: "name must be a non-empty string" });
      return;
    }
    if (typeof command !== "string" || !command.trim()) {
      event.json(400, { error: "command must be a non-empty string" });
      return;
    }
    if (typeof interval_seconds !== "number" || !Number.isInteger(interval_seconds) || interval_seconds <= 0) {
      event.json(400, { error: "interval_seconds must be an integer greater than 0" });
      return;
    }
    if (status !== "ACTIVE" && status !== "PAUSED") {
      event.json(400, { error: "status must be either ACTIVE or PAUSED" });
      return;
    }

    // Check if task already exists
    const existing = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id);
    if (existing) {
      event.json(400, { error: `Task with id '${id}' already exists` });
      return;
    }

    // Insert task
    db.prepare(
      "INSERT INTO tasks (id, name, command, interval_seconds, status) VALUES (?, ?, ?, ?, ?)"
    ).run(id, name, command, interval_seconds, status);

    event.json(201, {
      id,
      name,
      command,
      interval_seconds,
      status,
    });
  } catch (err: any) {
    event.json(500, { error: err.message });
  }
};
