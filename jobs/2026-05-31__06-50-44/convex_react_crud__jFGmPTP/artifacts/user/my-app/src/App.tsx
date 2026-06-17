import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "./App.css";

type TaskStatus = "todo" | "done";

function App() {
  const runId = import.meta.env.VITE_ZEALT_RUN_ID as string | undefined;
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<TaskStatus | "all">("all");

  const tasks = useQuery(
    api.tasks.list,
    runId
      ? {
          runId,
          status: filter === "all" ? undefined : filter,
        }
      : "skip",
  );

  const addTask = useMutation(api.tasks.add);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const removeTask = useMutation(api.tasks.remove);

  const visibleTasks = useMemo(() => tasks ?? [], [tasks]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!runId) {
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    await addTask({ text: trimmed, runId });
    setText("");
  };

  if (!runId) {
    return (
      <div className="app">
        <header>
          <h1>Task Manager</h1>
          <p className="subtitle">
            Missing <code>VITE_ZEALT_RUN_ID</code>. Provide it in your environment
            to enable data isolation.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <div>
          <h1>Task Manager</h1>
          <p className="subtitle">Run ID: {runId}</p>
        </div>
        <div className="filters">
          <button
            type="button"
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={filter === "todo" ? "active" : ""}
            onClick={() => setFilter("todo")}
          >
            Todo
          </button>
          <button
            type="button"
            className={filter === "done" ? "active" : ""}
            onClick={() => setFilter("done")}
          >
            Done
          </button>
        </div>
      </header>

      <form className="task-form" onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a new task"
          aria-label="Task description"
        />
        <button type="submit">Add Task</button>
      </form>

      <section className="task-list">
        {visibleTasks.length === 0 ? (
          <p className="empty">No tasks yet. Add your first one above.</p>
        ) : (
          <ul>
            {visibleTasks.map((task) => (
              <li key={task._id} className={task.status === "done" ? "done" : ""}>
                <div>
                  <p className="task-text">{task.text}</p>
                  <span className="status">Status: {task.status}</span>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() =>
                      updateStatus({
                        id: task._id,
                        status: task.status === "todo" ? "done" : "todo",
                      })
                    }
                  >
                    Mark {task.status === "todo" ? "Done" : "Todo"}
                  </button>
                  <button
                    type="button"
                    className="delete"
                    onClick={() => removeTask({ id: task._id })}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;
