"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

type TodoItem = {
  id: string;
  text: string;
};

const TODOS_KEY = "todos";

const makeId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Realtime collaborative to-do list.
 *
 * Uses RedwoodSDK's `useSyncedState` primitive to share a single list of
 * items across every connected client on `/`. The state is stored under a
 * single, global key on the `SyncedStateServer` Durable Object so the server
 * remains the source of truth: any client that joins after items were
 * already added will see them on first render, and any change made by one
 * client is pushed to every other client in realtime.
 */
export const TodoList = () => {
  const [todos, setTodos] = useSyncedState<TodoItem[]>([], TODOS_KEY);
  const [draft, setDraft] = useState("");

  const addTodo = () => {
    const text = draft.trim();
    if (!text) return;
    setTodos((current) => [...current, { id: makeId(), text }]);
    setDraft("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTodo();
    }
  };

  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 480,
        margin: "2rem auto",
        padding: "0 1rem",
      }}
    >
      <h1 style={{ marginBottom: "0.25rem" }}>Collaborative To-Do List</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Open this page in two windows &mdash; changes sync in realtime.
      </p>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          margin: "1rem 0",
        }}
      >
        <input
          data-testid="todo-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What needs to be done?"
          aria-label="New to-do item"
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            fontSize: "1rem",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        />
        <button
          data-testid="todo-add"
          type="button"
          onClick={addTodo}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: "pointer",
            border: "1px solid #2563eb",
            background: "#2563eb",
            color: "white",
            borderRadius: 6,
          }}
        >
          Add
        </button>
      </div>

      {todos.length === 0 ? (
        <p data-testid="todo-empty" style={{ color: "#999" }}>
          No items yet. Add the first one above.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {todos.map((item) => (
            <li
              key={item.id}
              data-testid="todo-item"
              style={{
                padding: "0.5rem 0.75rem",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                background: "#f9fafb",
              }}
            >
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};
