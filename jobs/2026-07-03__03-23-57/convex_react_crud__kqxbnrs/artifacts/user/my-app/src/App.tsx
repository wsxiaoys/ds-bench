import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function App() {
  const runId = import.meta.env.VITE_RUN_ID || "default-run-id";
  const [statusFilter, setStatusFilter] = useState<"all" | "todo" | "done">("all");
  const [newTaskText, setNewTaskText] = useState("");

  // Fetch tasks
  const tasks = useQuery(api.tasks.get, {
    runId,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  // Mutations
  const addTask = useMutation(api.tasks.add);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    try {
      await addTask({ text: newTaskText.trim(), runId });
      setNewTaskText("");
    } catch (err) {
      console.error("Failed to add task:", err);
    }
  };

  const handleToggleStatus = async (taskId: any, currentStatus: "todo" | "done") => {
    const newStatus = currentStatus === "todo" ? "done" : "todo";
    try {
      await updateStatus({ id: taskId, status: newStatus });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleDeleteTask = async (taskId: any) => {
    try {
      await deleteTask({ id: taskId });
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  return (
    <div style={{ padding: "40px 20px", maxWidth: "600px", margin: "0 REDACTED", textAlign: "left" }}>
      <header style={{ marginBottom: "30px", borderBottom: "1px solid var(--border)", paddingBottom: "20px" }}>
        <h1 style={{ fontSize: "32px", margin: "0 0 10px 0", textAlign: "left" }}>Task Manager</h1>
        <p style={{ fontSize: "14px", color: "var(--text)" }}>
          Run ID: <code style={{ color: "var(--accent)" }}>{runId}</code>
        </p>
      </header>

      {/* Add Task Form */}
      <form onSubmit={handleAddTask} style={{ display: "flex", gap: "10px", marginBottom: "30px" }}>
        <input
          type="text"
          placeholder="What needs to be done?"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          style={{
            flexGrow: 1,
            padding: "10px 15px",
            fontSize: "16px",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            background: "var(--code-bg)",
            color: "var(--text-h)",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Add Task
        </button>
      </form>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        {(["all", "todo", "done"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            style={{
              padding: "6px 12px",
              fontSize: "14px",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              background: statusFilter === filter ? "var(--accent-bg)" : "transparent",
              color: statusFilter === filter ? "var(--accent)" : "var(--text)",
              borderColor: statusFilter === filter ? "var(--accent)" : "var(--border)",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Task List */}
      {tasks === undefined ? (
        <div style={{ textAlign: "center", padding: "20px", color: "var(--text)" }}>Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", border: "1px dashed var(--border)", borderRadius: "8px", color: "var(--text)" }}>
          No tasks found for this filter.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          {tasks.map((task) => (
            <li
              key={task._id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                background: "var(--social-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexGrow: 1, marginRight: "12px" }}>
                <input
                  type="checkbox"
                  checked={task.status === "done"}
                  onChange={() => handleToggleStatus(task._id, task.status)}
                  style={{
                    width: "18px",
                    height: "18px",
                    cursor: "pointer",
                    accentColor: "var(--accent)",
                  }}
                />
                <span
                  style={{
                    fontSize: "16px",
                    textDecoration: task.status === "done" ? "line-through" : "none",
                    color: task.status === "done" ? "var(--text)" : "var(--text-h)",
                    wordBreak: "break-word",
                  }}
                >
                  {task.text}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => handleToggleStatus(task._id, task.status)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  {task.status === "todo" ? "Complete" : "Undo"}
                </button>
                <button
                  onClick={() => handleDeleteTask(task._id)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    borderRadius: "4px",
                    border: "1px solid #ff4d4f",
                    background: "transparent",
                    color: "#ff4d4f",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
