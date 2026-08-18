import { component$, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import { routeLoader$, type DocumentHead } from '@builder.io/qwik-city';
import { db } from '../../lib/db';

export const useInitialDataLoader = routeLoader$(async () => {
  const tasks = db.prepare('SELECT * FROM tasks').all() as any[];
  const history = db.prepare(`
    SELECT h.*, t.name as task_name
    FROM execution_history h
    JOIN tasks t ON h.task_id = t.id
    ORDER BY h.timestamp DESC, h.id DESC
    LIMIT 100
  `).all() as any[];
  return { tasks, history };
});

export default component$(() => {
  const initialData = useInitialDataLoader();

  const state = useStore({
    tasks: initialData.value.tasks,
    history: initialData.value.history,
    error: '',
    success: '',
    // Form fields
    formId: '',
    formName: '',
    formCommand: '',
    formInterval: 10,
    formStatus: 'ACTIVE',
  });

  // Poll for updates on the client side to provide real-time updates
  useVisibleTask$(() => {
    const fetchUpdates = async () => {
      try {
        const tasksRes = await fetch('/api/tasks');
        if (tasksRes.ok) {
          state.tasks = await tasksRes.json();
        }

        const historyRes = await fetch('/api/history');
        if (historyRes.ok) {
          state.history = await historyRes.json();
        }
      } catch (err) {
        console.error('Failed to fetch updates:', err);
      }
    };

    const interval = setInterval(fetchUpdates, 2000);
    return () => clearInterval(interval);
  });

  const handlePause = $(async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}/pause`, { method: 'POST' });
      if (res.ok) {
        const task = state.tasks.find((t: any) => t.id === id);
        if (task) task.status = 'PAUSED';
      } else {
        const data = await res.json();
        state.error = data.error || 'Failed to pause task';
      }
    } catch (err: any) {
      state.error = err.message;
    }
  });

  const handleResume = $(async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}/resume`, { method: 'POST' });
      if (res.ok) {
        const task = state.tasks.find((t: any) => t.id === id);
        if (task) task.status = 'ACTIVE';
      } else {
        const data = await res.json();
        state.error = data.error || 'Failed to resume task';
      }
    } catch (err: any) {
      state.error = err.message;
    }
  });

  const handleTrigger = $(async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}/trigger`, { method: 'POST' });
      if (res.ok) {
        state.success = `Task '${id}' triggered successfully!`;
        setTimeout(() => { state.success = ''; }, 3000);
      } else {
        const data = await res.json();
        state.error = data.error || 'Failed to trigger task';
        setTimeout(() => { state.error = ''; }, 3000);
      }
    } catch (err: any) {
      state.error = err.message;
      setTimeout(() => { state.error = ''; }, 3000);
    }
  });

  const handleCreate = $(async () => {
    state.error = '';
    state.success = '';

    const id = state.formId.trim();
    const name = state.formName.trim();
    const command = state.formCommand.trim();
    const interval_seconds = parseInt(state.formInterval as any);
    const status = state.formStatus;

    if (!id) {
      state.error = 'Task ID is required';
      return;
    }
    if (!name) {
      state.error = 'Task Name is required';
      return;
    }
    if (!command) {
      state.error = 'Command is required';
      return;
    }
    if (isNaN(interval_seconds) || interval_seconds <= 0) {
      state.error = 'Interval must be a positive integer';
      return;
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, command, interval_seconds, status })
      });

      if (res.ok) {
        const newTask = await res.json();
        state.tasks.push(newTask);
        state.success = `Task '${id}' created successfully!`;
        // Reset form
        state.formId = '';
        state.formName = '';
        state.formCommand = '';
        state.formInterval = 10;
        state.formStatus = 'ACTIVE';
        setTimeout(() => { state.success = ''; }, 3000);
      } else {
        const data = await res.json();
        state.error = data.error || 'Failed to create task';
      }
    } catch (err: any) {
      state.error = err.message;
    }
  });

  return (
    <div class="container">
      <div class="header">
        <h1>Scheduled Tasks Dashboard</h1>
        <p>Manage background scheduled jobs and monitor their execution status in real-time.</p>
      </div>

      {state.error && <div class="card error-message">{state.error}</div>}
      {state.success && <div class="card success-message">{state.success}</div>}

      <div class="grid">
        {/* Left Column: Tasks and History */}
        <div>
          {/* Tasks List */}
          <div class="card">
            <h2>Configured Tasks</h2>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Command</th>
                    <th>Interval (s)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.tasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>
                        No tasks configured yet. Create one on the right!
                      </td>
                    </tr>
                  ) : (
                    state.tasks.map((task: any) => (
                      <tr key={task.id}>
                        <td><code>{task.id}</code></td>
                        <td><strong>{task.name}</strong></td>
                        <td><code>{task.command}</code></td>
                        <td>{task.interval_seconds}s</td>
                        <td>
                          <span class={`badge ${task.status === 'ACTIVE' ? 'badge-active' : 'badge-paused'}`}>
                            {task.status}
                          </span>
                        </td>
                        <td>
                          <div class="actions-cell">
                            {task.status === 'ACTIVE' ? (
                              <button
                                class="btn btn-sm btn-warning"
                                onClick$={() => handlePause(task.id)}
                              >
                                Pause
                              </button>
                            ) : (
                              <button
                                class="btn btn-sm btn-success"
                                onClick$={() => handleResume(task.id)}
                              >
                                Resume
                              </button>
                            )}
                            <button
                              class="btn btn-sm btn-primary"
                              onClick$={() => handleTrigger(task.id)}
                            >
                              Trigger
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Execution History */}
          <div class="card">
            <h2>Recent Execution History</h2>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Task Name</th>
                    <th>Status</th>
                    <th>Executed At</th>
                  </tr>
                </thead>
                <tbody>
                  {state.history.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: '#6b7280' }}>
                        No execution history logged yet.
                      </td>
                    </tr>
                  ) : (
                    state.history.map((log: any) => (
                      <tr key={log.id}>
                        <td>{log.task_name || log.task_id}</td>
                        <td>
                          <span class={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-failed'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td>{new Date(log.timestamp).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Create Task Form */}
        <div>
          <div class="card">
            <h2>Create New Task</h2>
            <form
              onSubmit$={(e) => {
                e.preventDefault();
                handleCreate();
              }}
            >
              <div class="form-group">
                <label for="taskId">Task ID (Slug/UUID)</label>
                <input
                  type="text"
                  id="taskId"
                  class="form-control"
                  placeholder="e.g. backup-db"
                  value={state.formId}
                  onInput$={(e: any) => { state.formId = e.target.value; }}
                  required
                />
              </div>

              <div class="form-group">
                <label for="taskName">Task Name</label>
                <input
                  type="text"
                  id="taskName"
                  class="form-control"
                  placeholder="e.g. Backup Database"
                  value={state.formName}
                  onInput$={(e: any) => { state.formName = e.target.value; }}
                  required
                />
              </div>

              <div class="form-group">
                <label for="taskCommand">Shell Command</label>
                <input
                  type="text"
                  id="taskCommand"
                  class="form-control"
                  placeholder="e.g. echo 'doing backup...'"
                  value={state.formCommand}
                  onInput$={(e: any) => { state.formCommand = e.target.value; }}
                  required
                />
              </div>

              <div class="form-group">
                <label for="taskInterval">Interval (seconds)</label>
                <input
                  type="number"
                  id="taskInterval"
                  class="form-control"
                  min="1"
                  value={state.formInterval}
                  onInput$={(e: any) => { state.formInterval = parseInt(e.target.value) || 0; }}
                  required
                />
              </div>

              <div class="form-group">
                <label for="taskStatus">Initial Status</label>
                <select
                  id="taskStatus"
                  class="form-control"
                  value={state.formStatus}
                  onChange$={(e: any) => { state.formStatus = e.target.value; }}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>

              <button type="submit" class="btn btn-primary" style={{ width: '100%' }}>
                Create Task
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Scheduled Tasks Dashboard",
  meta: [
    {
      name: "description",
      content: "Manage background scheduled jobs and monitor their execution status.",
    },
  ],
};
