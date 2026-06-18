import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function App() {
  const runId = import.meta.env.VITE_ZEALT_RUN_ID as string;
  const [newTaskText, setNewTaskText] = useState("");

  const tasks = useQuery(api.tasks.getTasks, { runId });
  const addTask = useMutation(api.tasks.addTask);
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (!text) return;
    await addTask({ text, runId });
    setNewTaskText("");
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "todo" ? "done" : "todo";
    await updateTaskStatus({ id: id as any, status: newStatus });
  };

  const handleDelete = async (id: string) => {
    await deleteTask({ id: id as any });
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Task Manager</h1>

      <form onSubmit={handleAddTask} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="Add a new task..."
          style={{ flex: 1, padding: 8, fontSize: 16 }}
        />
        <button type="submit" style={{ padding: "8px 16px", fontSize: 16 }}>
          Add
        </button>
      </form>

      {tasks === undefined ? (
        <p>Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <p>No tasks yet. Add one above!</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {tasks.map((task) => (
            <li
              key={task._id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <span
                style={{
                  flex: 1,
                  textDecoration: task.status === "done" ? "line-through" : "none",
                  color: task.status === "done" ? "#888" : "#000",
                }}
              >
                {task.text}
              </span>
              <button
                onClick={() => handleToggleStatus(task._id, task.status)}
                style={{
                  padding: "4px 12px",
                  fontSize: 14,
                  background: task.status === "done" ? "#4caf50" : "#ff9800",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                {task.status === "done" ? "Done" : "Todo"}
              </button>
              <button
                onClick={() => handleDelete(task._id)}
                style={{
                  padding: "4px 12px",
                  fontSize: 14,
                  background: "#f44336",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;