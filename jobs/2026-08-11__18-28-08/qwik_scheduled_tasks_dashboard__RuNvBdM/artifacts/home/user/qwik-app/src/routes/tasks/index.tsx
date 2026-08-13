import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import db from "../../db";
import { exec } from "child_process";

export const useTasksLoader = routeLoader$(async () => {
  try {
    return db.prepare("SELECT * FROM tasks").all() as any[];
  } catch (err: any) {
    console.error("Failed to load tasks:", err);
    return [];
  }
});

export const useHistoryLoader = routeLoader$(async () => {
  try {
    return db.prepare(`
      SELECT h.id, h.task_id, h.status, h.timestamp, t.name as task_name
      FROM execution_history h
      JOIN tasks t ON h.task_id = t.id
      ORDER BY h.timestamp DESC
      LIMIT 50
    `).all() as any[];
  } catch (err: any) {
    console.error("Failed to load history:", err);
    return [];
  }
});

export const useCreateTaskAction = routeAction$(async (data, { fail }) => {
  const id = String(data.id || "").trim();
  const name = String(data.name || "").trim();
  const command = String(data.command || "").trim();
  const interval_seconds = parseInt(String(data.interval_seconds || ""));
  const status = String(data.status || "").trim();

  if (!id) return fail(400, { message: "ID is required" });
  if (!name) return fail(400, { message: "Name is required" });
  if (!command) return fail(400, { message: "Command is required" });
  if (isNaN(interval_seconds) || interval_seconds <= 0) {
    return fail(400, { message: "Interval must be a positive integer" });
  }
  if (status !== "ACTIVE" && status !== "PAUSED") {
    return fail(400, { message: "Status must be ACTIVE or PAUSED" });
  }

  try {
    const existing = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id);
    if (existing) {
      return fail(400, { message: `Task with ID '${id}' already exists` });
    }

    db.prepare(
      "INSERT INTO tasks (id, name, command, interval_seconds, status) VALUES (?, ?, ?, ?, ?)"
    ).run(id, name, command, interval_seconds, status);

    return { success: true };
  } catch (err: any) {
    return fail(500, { message: err.message });
  }
});

export const usePauseTaskAction = routeAction$(async (data, { fail }) => {
  const id = String(data.id || "").trim();
  if (!id) return fail(400, { message: "ID is required" });
  try {
    db.prepare("UPDATE tasks SET status = 'PAUSED' WHERE id = ?").run(id);
    return { success: true };
  } catch (err: any) {
    return fail(500, { message: err.message });
  }
});

export const useResumeTaskAction = routeAction$(async (data, { fail }) => {
  const id = String(data.id || "").trim();
  if (!id) return fail(400, { message: "ID is required" });
  try {
    db.prepare("UPDATE tasks SET status = 'ACTIVE' WHERE id = ?").run(id);
    return { success: true };
  } catch (err: any) {
    return fail(500, { message: err.message });
  }
});

export const useTriggerTaskAction = routeAction$(async (data, { fail }) => {
  const id = String(data.id || "").trim();
  if (!id) return fail(400, { message: "ID is required" });
  try {
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    if (!task) return fail(404, { message: "Task not found" });

    exec(task.command, (error) => {
      const status = error === null ? "SUCCESS" : "FAILED";
      const timestamp = new Date().toISOString();
      try {
        db.prepare(
          "INSERT INTO execution_history (task_id, status, timestamp) VALUES (?, ?, ?)"
        ).run(id, status, timestamp);
      } catch (err) {
        console.error(`[TriggerAction] Failed to log history:`, err);
      }
    });

    return { success: true };
  } catch (err: any) {
    return fail(500, { message: err.message });
  }
});

export const useDeleteTaskAction = routeAction$(async (data, { fail }) => {
  const id = String(data.id || "").trim();
  if (!id) return fail(400, { message: "ID is required" });
  try {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return { success: true };
  } catch (err: any) {
    return fail(500, { message: err.message });
  }
});

export default component$(() => {
  const tasksSignal = useTasksLoader();
  const historySignal = useHistoryLoader();

  const createTask = useCreateTaskAction();
  const pauseTask = usePauseTaskAction();
  const resumeTask = useResumeTaskAction();
  const triggerTask = useTriggerTaskAction();
  const deleteTask = useDeleteTaskAction();

  return (
    <div class="container">
      <header>
        <h1>Scheduled Tasks Dashboard</h1>
        <p>Manage background jobs, intervals, and execution history.</p>
      </header>

      {createTask.value?.failed && (
        <div class="error-banner">
          Error: {createTask.value.message}
        </div>
      )}

      {createTask.value?.success && (
        <div class="success-banner">
          Task created successfully!
        </div>
      )}

      <div class="grid">
        {/* Left Column: Tasks List & History */}
        <div>
          {/* Tasks List */}
          <div class="card">
            <h2 class="card-title">Configured Tasks</h2>
            {tasksSignal.value.length === 0 ? (
              <div class="empty-state">
                No tasks configured yet. Use the form on the right to create one.
              </div>
            ) : (
              <div class="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Name / ID</th>
                      <th>Command</th>
                      <th>Interval</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasksSignal.value.map((task) => (
                      <tr key={task.id}>
                        <td>
                          <strong>{task.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ID: <code>{task.id}</code>
                          </div>
                        </td>
                        <td>
                          <code>{task.command}</code>
                        </td>
                        <td>{task.interval_seconds}s</td>
                        <td>
                          <span class={`badge badge-${task.status.toLowerCase()}`}>
                            {task.status}
                          </span>
                        </td>
                        <td>
                          <div class="btn-group">
                            {task.status === "ACTIVE" ? (
                              <Form action={pauseTask}>
                                <input type="hidden" name="id" value={task.id} />
                                <button type="submit" class="btn btn-warning btn-sm">
                                  Pause
                                </button>
                              </Form>
                            ) : (
                              <Form action={resumeTask}>
                                <input type="hidden" name="id" value={task.id} />
                                <button type="submit" class="btn btn-success btn-sm">
                                  Resume
                                </button>
                              </Form>
                            )}

                            <Form action={triggerTask}>
                              <input type="hidden" name="id" value={task.id} />
                              <button type="submit" class="btn btn-primary btn-sm">
                                Trigger
                              </button>
                            </Form>

                            <Form action={deleteTask}>
                              <input type="hidden" name="id" value={task.id} />
                              <button type="submit" class="btn btn-danger btn-sm">
                                Delete
                              </button>
                            </Form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Execution History */}
          <div class="card">
            <h2 class="card-title">Recent Execution History</h2>
            {historySignal.value.length === 0 ? (
              <div class="empty-state">
                No execution history yet. Active tasks will execute automatically, or you can trigger them manually.
              </div>
            ) : (
              <div class="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historySignal.value.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <strong>{log.task_name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ID: <code>{log.task_id}</code>
                          </div>
                        </td>
                        <td>
                          <span class={`badge badge-${log.status.toLowerCase()}`}>
                            {log.status}
                          </span>
                        </td>
                        <td>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Create Form */}
        <div>
          <div class="card">
            <h2 class="card-title">Create New Task</h2>
            <Form action={createTask}>
              <div class="form-group">
                <label for="id">Task ID (unique slug/UUID)</label>
                <input
                  type="text"
                  id="id"
                  name="id"
                  class="form-control"
                  placeholder="e.g. log-cleaner"
                  required
                />
              </div>

              <div class="form-group">
                <label for="name">Human-Readable Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  class="form-control"
                  placeholder="e.g. Clean Temporary Logs"
                  required
                />
              </div>

              <div class="form-group">
                <label for="command">Shell Command</label>
                <input
                  type="text"
                  id="command"
                  name="command"
                  class="form-control"
                  placeholder="e.g. echo 'cleaning...'"
                  required
                />
              </div>

              <div class="form-group">
                <label for="interval_seconds">Interval (seconds)</label>
                <input
                  type="number"
                  id="interval_seconds"
                  name="interval_seconds"
                  class="form-control"
                  min="1"
                  placeholder="e.g. 10"
                  required
                />
              </div>

              <div class="form-group">
                <label for="status">Initial Status</label>
                <select id="status" name="status" class="form-control" required>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>

              <button type="submit" class="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                Create Task
              </button>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Scheduled Tasks Dashboard",
};
