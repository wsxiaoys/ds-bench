"use client";

import type { Todo } from "./types";
import { addTodo, toggleTodo, deleteTodoAction } from "./actions";

export const TodoApp = ({ todos, remaining }: { todos: Todo[]; remaining: number }) => {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Todos</h1>

      <form action={addTodo} style={styles.addForm}>
        <input
          name="title"
          aria-label="New todo title"
          placeholder="What needs to be done?"
          style={styles.input}
          REDACTEDFocus
        />
        <button type="submit" style={styles.addButton}>
          Add
        </button>
      </form>

      <p style={styles.remaining}>
        <span data-testid="remaining-count">{remaining}</span> item
        {remaining === 1 ? "" : "s"} left
      </p>

      <ul style={styles.list}>
        {todos.map((todo) => (
          <li
            key={todo.id}
            data-done={todo.done ? "true" : "false"}
            style={styles.listItem}
          >
            <form action={toggleTodo} style={styles.toggleForm}>
              <input type="hidden" name="id" value={todo.id} />
              <input
                type="checkbox"
                name="done"
                aria-label={`Toggle ${todo.title}`}
                defaultChecked={todo.done}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                style={styles.checkbox}
              />
            </form>

            <span
              data-testid="todo-title"
              style={todo.done ? styles.titleDone : styles.titleNotDone}
            >
              {todo.title}
            </span>

            <form action={deleteTodoAction} style={styles.deleteForm}>
              <input type="hidden" name="id" value={todo.id} />
              <button
                type="submit"
                aria-label={`Delete ${todo.title}`}
                style={styles.deleteButton}
              >
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>

      {todos.length === 0 && <p style={styles.empty}>No todos yet. Add one above!</p>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 560,
    margin: "0 REDACTED",
    padding: "2.5rem 1.5rem",
    fontFamily: "system-ui, -apple-system, 'Noto Sans', sans-serif",
    color: "#1a1a1a",
  },
  title: {
    fontSize: "2.25rem",
    fontWeight: 700,
    margin: "0 0 1.5rem",
  },
  addForm: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1rem",
  },
  input: {
    flex: 1,
    padding: "0.625rem 0.875rem",
    fontSize: "1rem",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    outline: "none",
  },
  addButton: {
    padding: "0.625rem 1.25rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#f47238",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  remaining: {
    fontSize: "0.875rem",
    color: "#6b7280",
    marginBottom: "1rem",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem 0",
    borderBottom: "1px solid #e5e7eb",
  },
  toggleForm: {
    margin: 0,
    display: "inline-flex",
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: "pointer",
  },
  titleNotDone: {
    flex: 1,
    fontSize: "1rem",
  },
  titleDone: {
    flex: 1,
    fontSize: "1rem",
    textDecoration: "line-through",
    color: "#9ca3af",
  },
  deleteForm: {
    margin: 0,
    display: "inline-flex",
  },
  deleteButton: {
    padding: "0.25rem 0.75rem",
    fontSize: "0.875rem",
    color: "#dc2626",
    backgroundColor: "transparent",
    border: "1px solid #fecaca",
    borderRadius: 6,
    cursor: "pointer",
  },
  empty: {
    color: "#9ca3af",
    fontSize: "0.95rem",
  },
};