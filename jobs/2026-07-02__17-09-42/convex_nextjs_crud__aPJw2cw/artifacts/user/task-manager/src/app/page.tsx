"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Home() {
  const runId = process.env.NEXT_PUBLIC_RUN_ID ?? "";
  const tasks = useQuery(api.tasks.list, { runId }) ?? [];
  const addTask = useMutation(api.tasks.add);
  const toggleTask = useMutation(api.tasks.toggle);
  const deleteTask = useMutation(api.tasks.remove);

  const [text, setText] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    await addTask({ text: trimmed, runId });
    setText("");
  };

  return (
    <div style={styles.container}>
      <main style={styles.main}>
        <h1 style={styles.title}>Task Manager</h1>
        <p style={styles.subtitle}>Run ID: {runId || "(unset)"}</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            data-testid="task-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs to be done?"
            style={styles.input}
            aria-label="New task"
          />
          <button
            data-testid="add-button"
            type="submit"
            style={styles.addButton}
          >
            Add
          </button>
        </form>

        {tasks.length === 0 ? (
          <p style={styles.empty}>No tasks yet. Add one above.</p>
        ) : (
          <ul style={styles.list}>
            {tasks.map((task) => (
              <li
                key={task._id}
                data-testid="task-item"
                style={{
                  ...styles.taskItem,
                  ...(task.isCompleted ? styles.taskItemCompleted : {}),
                }}
              >
                <button
                  data-testid="toggle-button"
                  type="button"
                  onClick={() => toggleTask({ id: task._id })}
                  aria-pressed={task.isCompleted}
                  aria-label={
                    task.isCompleted ? "Mark task incomplete" : "Mark task complete"
                  }
                  style={{
                    ...styles.toggleButton,
                    ...(task.isCompleted ? styles.toggleButtonCompleted : {}),
                  }}
                >
                  {task.isCompleted ? "✓" : "○"}
                </button>
                <span
                  style={{
                    ...styles.taskText,
                    ...(task.isCompleted ? styles.taskTextCompleted : {}),
                  }}
                >
                  {task.text}
                </span>
                <button
                  data-testid="delete-button"
                  type="button"
                  onClick={() => deleteTask({ id: task._id })}
                  aria-label="Delete task"
                  style={styles.deleteButton}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "#f5f5f5",
    padding: "2rem 1rem",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#111",
  },
  main: {
    maxWidth: "640px",
    margin: "0 REDACTED",
    background: "#fff",
    padding: "2rem",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "2rem",
  },
  subtitle: {
    margin: "0 0 1.5rem 0",
    color: "#666",
    fontSize: "0.875rem",
    wordBreak: "break-all",
  },
  form: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1.5rem",
  },
  input: {
    flex: 1,
    padding: "0.625rem 0.75rem",
    fontSize: "1rem",
    border: "1px solid #d0d0d0",
    borderRadius: "6px",
    outline: "none",
  },
  addButton: {
    padding: "0.625rem 1.25rem",
    fontSize: "1rem",
    background: "#0a7cff",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  empty: {
    color: "#888",
    textAlign: "center",
    padding: "1.5rem 0",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  taskItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem",
    background: "#fafafa",
    border: "1px solid #ececec",
    borderRadius: "8px",
  },
  taskItemCompleted: {
    background: "#f0fff4",
  },
  toggleButton: {
    width: "2rem",
    height: "2rem",
    borderRadius: "50%",
    border: "2px solid #bbb",
    background: "#fff",
    cursor: "pointer",
    fontSize: "1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButtonCompleted: {
    background: "#0a7cff",
    color: "#fff",
    borderColor: "#0a7cff",
  },
  taskText: {
    flex: 1,
    fontSize: "1rem",
  },
  taskTextCompleted: {
    textDecoration: "line-through",
    color: "#888",
  },
  deleteButton: {
    padding: "0.4rem 0.75rem",
    background: "#ffeded",
    color: "#b00020",
    border: "1px solid #f3c2c2",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
};