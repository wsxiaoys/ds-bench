import { component$, useStore, useVisibleTask$, $, useSignal } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";

export const useTasksData = routeLoader$(async () => {
  const db = (await import("../../lib/db")).default;
  const tasks = db.prepare("SELECT * FROM tasks").all() as any[];
  const history = db.prepare(
    "SELECT h.*, t.name as task_name FROM execution_history h JOIN tasks t ON h.task_id = t.id ORDER BY h.timestamp DESC LIMIT 50"
  ).all() as any[];
  return { tasks, history };
});

export default component$(() => {
  const initialData = useTasksData();
  const isRefreshing = useSignal(false);

  const state = useStore({
    tasks: initialData.value.tasks,
    history: initialData.value.history,
    // Form fields
    newId: "",
    newName: "",
    newCommand: "",
    newInterval: 10,
    newStatus: "ACTIVE" as "ACTIVE" | "PAUSED",
    formError: "",
    formSuccess: "",
  });

  const refreshData = $(async () => {
    isRefreshing.value = true;
    try {
      const resTasks = await fetch("/api/tasks");
      if (!resTasks.ok) return;
      const tasks = (await resTasks.json()) as any[];
      state.tasks = tasks;

      // Fetch history for each task and merge
      const allHistory: any[] = [];
      for (const task of tasks) {
        const resHist = await fetch(`/api/tasks/${task.id}/history`);
        if (resHist.ok) {
          const hist = (await resHist.json()) as any[];
          for (const h of hist) {
            allHistory.push({
              ...h,
              task_name: task.name,
            });
          }
        }
      }
      // Sort combined history by timestamp descending
      allHistory.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      state.history = allHistory.slice(0, 50);
    } catch (err) {
      console.error("Error refreshing data:", err);
    } finally {
      isRefreshing.value = false;
    }
  });

  // Auto-refresh every 3 seconds on the client
  useVisibleTask$(() => {
    const timer = setInterval(() => {
      refreshData();
    }, 3000);
    return () => clearInterval(timer);
  });

  const handleSubmit = $(async (e: Event) => {
    e.preventDefault();
    state.formError = "";
    state.formSuccess = "";

    const payload = {
      id: state.newId.trim(),
      name: state.newName.trim(),
      command: state.newCommand.trim(),
      interval_seconds: Number(state.newInterval),
      status: state.newStatus,
    };

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        state.formError = errData.error || "Failed to create task";
        return;
      }

      state.formSuccess = "Task created successfully!";
      // Reset form fields
      state.newId = "";
      state.newName = "";
      state.newCommand = "";
      state.newInterval = 10;
      state.newStatus = "ACTIVE";

      // Refresh data
      await refreshData();
    } catch (err: any) {
      state.formError = err.message || "An unexpected error occurred";
    }
  });

  const handlePause = $(async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}/pause`, { method: "POST" });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(`Failed to pause task ${id}:`, err);
    }
  });

  const handleResume = $(async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}/resume`, { method: "POST" });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(`Failed to resume task ${id}:`, err);
    }
  });

  const handleTrigger = $(async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}/trigger`, { method: "POST" });
      if (res.ok) {
        // Give it a tiny moment to start and write history, then refresh
        setTimeout(async () => {
          await refreshData();
        }, 500);
      }
    } catch (err) {
      console.error(`Failed to trigger task ${id}:`, err);
    }
  });

  return (
    <div class="container">
      <header>
        <div>
          <h1>Scheduled Tasks Dashboard</h1>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Manage background tasks and monitor execution history in real-time.
          </p>
        </div>
        <div class="refresh-indicator">
          {isRefreshing.value && <div class="spinner" />}
          <span>Auto-refreshing...</span>
          <button class="btn btn-secondary btn-sm" onClick$={refreshData}>
            Refresh Now
          </button>
        </div>
      </header>

      <div class="dashboard-grid">
        {/* Left Column: Create Task */}
        <section class="card">
          <h2>Create New Task</h2>
          {state.formError && <div class="alert alert-danger">{state.formError}</div>}
          {state.formSuccess && <div class="alert alert-success">{state.formSuccess}</div>}

          <form onSubmit$={handleSubmit}>
            <div class="form-group">
              <label>Task ID (unique slug/UUID)</label>
              <input
                type="text"
                class="form-control"
                placeholder="e.g., backup-db"
                value={state.newId}
                onInput$={(e) => {
                  state.newId = (e.target as HTMLInputElement).value;
                }}
                required
              />
            </div>

            <div class="form-group">
              <label>Task Name</label>
              <input
                type="text"
                class="form-control"
                placeholder="e.g., Database Backup"
                value={state.newName}
                onInput$={(e) => {
                  state.newName = (e.target as HTMLInputElement).value;
                }}
                required
              />
            </div>

            <div class="form-group">
              <label>Shell Command</label>
              <input
                type="text"
                class="form-control"
                placeholder="e.g., echo 'backup complete'"
                value={state.newCommand}
                onInput$={(e) => {
                  state.newCommand = (e.target as HTMLInputElement).value;
                }}
                required
              />
            </div>

            <div class="form-group">
              <label>Interval (seconds)</label>
              <input
                type="number"
                class="form-control"
                min="1"
                value={state.newInterval}
                onInput$={(e) => {
                  state.newInterval = Number((e.target as HTMLInputElement).value);
                }}
                required
              />
            </div>

            <div class="form-group">
              <label>Initial Status</label>
              <select
                class="form-control"
                value={state.newStatus}
                onChange$={(e) => {
                  state.newStatus = (e.target as HTMLSelectElement).value as "ACTIVE" | "PAUSED";
                }}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAUSED">PAUSED</option>
              </select>
            </div>

            <button type="submit" class="btn btn-primary" style={{ width: "100%" }}>
              Create Task
            </button>
          </form>
        </section>

        {/* Right Column: Tasks List */}
        <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div class="card" style={{ flex: 1 }}>
            <h2>Configured Tasks</h2>
            {state.tasks.length === 0 ? (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem" }}>
                No tasks configured yet. Use the form on the left to create one.
              </p>
            ) : (
              state.tasks.map((task) => (
                <div key={task.id} class="task-item">
                  <div class="task-info">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <h3>{task.name}</h3>
                      <span
                        class={`badge ${
                          task.status === "ACTIVE" ? "badge-active" : "badge-paused"
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                    <div class="task-meta">
                      ID: <strong style={{ color: "var(--text)" }}>{task.id}</strong> | Interval:{" "}
                      <strong>{task.interval_seconds}s</strong>
                    </div>
                    <div style={{ marginTop: "0.5rem" }}>
                      <span class="task-command">{task.command}</span>
                    </div>
                  </div>
                  <div class="btn-group">
                    {task.status === "ACTIVE" ? (
                      <button
                        class="btn btn-secondary btn-sm"
                        onClick$={() => handlePause(task.id)}
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        class="btn btn-primary btn-sm"
                        onClick$={() => handleResume(task.id)}
                      >
                        Resume
                      </button>
                    )}
                    <button class="btn btn-secondary btn-sm" onClick$={() => handleTrigger(task.id)}>
                      Trigger
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Bottom Section: Combined Execution History */}
      <section class="card history-section">
        <h2>Recent Execution History Logs</h2>
        <div style={{ overflowX: "auto" }}>
          {state.history.length === 0 ? (
            <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem" }}>
              No execution history logged yet. Active tasks will execute on their intervals, or you
              can trigger them manually.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Task ID</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {state.history.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <strong>{log.task_name || log.task_id}</strong>
                    </td>
                    <td>
                      <code style={{ fontSize: "0.8rem" }}>{log.task_id}</code>
                    </td>
                    <td>
                      <span
                        class={`badge ${
                          log.status === "SUCCESS" ? "badge-success" : "badge-failed"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Scheduled Tasks Dashboard",
  meta: [
    {
      name: "description",
      content: "Manage and monitor background scheduled tasks",
    },
  ],
};
