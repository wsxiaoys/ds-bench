import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import "./App.css";

function App() {
  // The run id isolates this app instance's data from other concurrent runs.
  const runId = import.meta.env.VITE_RUN_ID as string;
  if (!runId) {
    throw new Error(
      "Missing VITE_RUN_ID environment variable. Set it in your .env file.",
    );
  }

  const tasks = useQuery(api.tasks.getTasks, { runId }) ?? [];
  const addTask = useMutation(api.tasks.addTask);
  const toggleTask = useMutation(api.tasks.toggleTask);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const [newTaskText, setNewTaskText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (text === "") {
      return;
    }
    await addTask({ text, runId });
    setNewTaskText("");
  };

  return (
    <main className="app">
      <h1>Task Manager</h1>
      <p className="run-id">Run ID: {runId}</p>

      <form className="add-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="What needs to be done?"
          aria-label="New task text"
        />
        <button type="submit">Add Task</button>
      </form>

      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task._id} className={`task ${task.status}`}>
            <span className="task-text">{task.text}</span>
            <span className="task-status">{task.status}</span>
            <div className="task-actions">
              <button
                type="button"
                className="toggle"
                onClick={() => toggleTask({ id: task._id })}
                aria-label="Toggle task status"
              >
                {task.status === "todo" ? "Mark done" : "Mark todo"}
              </button>
              <button
                type="button"
                className="delete"
                onClick={() => deleteTask({ id: task._id })}
                aria-label="Delete task"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {tasks.length === 0 && (
        <p className="empty">No tasks yet. Add one above to get started!</p>
      )}
    </main>
  );
}

export default App;