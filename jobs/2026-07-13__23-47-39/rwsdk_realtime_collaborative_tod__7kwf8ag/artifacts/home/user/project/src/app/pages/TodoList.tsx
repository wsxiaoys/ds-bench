"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

type TodoItem = {
  id: string;
  text: string;
};

const SHARED_KEY = "todos";

export const TodoList = () => {
  // The shared list of to-do items, synchronized across all connected clients
  // via the SyncedStateServer Durable Object. The server is the source of
  // truth, so clients connecting late still see existing items.
  const [todos, setTodos] = useSyncedState<TodoItem[]>([], SHARED_KEY);
  const [input, setInput] = useState("");

  const addItem = () => {
    const text = input.trim();
    if (!text) {
      return;
    }
    setTodos((prev) => [...prev, { id: crypto.randomUUID(), text }]);
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addItem();
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Collaborative To-Do List</h1>
      <p style={{ color: "#666" }}>
        Open this page in another browser window — items added here appear there
        in realtime.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <input
          data-testid="todo-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a new to-do item..."
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />
        <button
          data-testid="todo-add"
          type="button"
          onClick={addItem}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 6,
            border: "none",
            background: "#111",
            color: "#fff",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Add
        </button>
      </div>

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
              padding: "0.75rem 1rem",
              borderRadius: 6,
              border: "1px solid #eee",
              background: "#fafafa",
            }}
          >
            {item.text}
          </li>
        ))}
      </ul>
    </main>
  );
};