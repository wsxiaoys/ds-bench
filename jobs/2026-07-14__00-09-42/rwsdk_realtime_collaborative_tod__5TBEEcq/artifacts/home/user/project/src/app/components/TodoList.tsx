"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

export const TodoList = () => {
  const [todos, setTodos] = useSyncedState<string[]>([], "todos");
  const [inputValue, setInputValue] = useState("");

  const addTodo = () => {
    const text = inputValue.trim();
    if (!text) return;
    setTodos((prev) => [...prev, text]);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addTodo();
    }
  };

  return (
    <div style={{ maxWidth: "480px", margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Collaborative To-Do List</h1>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          data-testid="todo-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a new to-do..."
          style={{ flex: 1, padding: "0.5rem", fontSize: "1rem" }}
        />
        <button
          data-testid="todo-add"
          onClick={addTodo}
          style={{ padding: "0.5rem 1rem", fontSize: "1rem", cursor: "pointer" }}
        >
          Add
        </button>
      </div>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {todos.map((todo, index) => (
          <li
            key={index}
            data-testid="todo-item"
            style={{
              padding: "0.5rem",
              borderBottom: "1px solid #eee",
              fontSize: "1rem",
            }}
          >
            {todo}
          </li>
        ))}
      </ul>
    </div>
  );
};
