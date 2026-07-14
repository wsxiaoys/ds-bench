"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

export const TodoList = () => {
  const [todos, setTodos] = useSyncedState<string[]>([], "todos");
  const [inputValue, setInputValue] = useState("");

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setTodos((prev) => [...(prev || []), inputValue.trim()]);
    setInputValue("");
  };

  const currentTodos = Array.isArray(todos) ? todos : [];

  return (
    <div style={{
      maxWidth: "500px",
      margin: "40px auto",
      padding: "20px",
      fontFamily: "system-ui, sans-serif",
      backgroundColor: "#ffffff",
      borderRadius: "8px",
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      border: "1px solid #e2e8f0"
    }}>
      <h1 style={{
        fontSize: "24px",
        fontWeight: "bold",
        marginBottom: "20px",
        color: "#1a202c",
        textAlign: "center"
      }}>
        Collaborative To-Do List
      </h1>

      <form onSubmit={handleAddTodo} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Add a new task..."
          data-testid="todo-input"
          style={{
            flex: 1,
            padding: "10px 14px",
            fontSize: "16px",
            border: "1px solid #cbd5e0",
            borderRadius: "6px",
            outline: "none"
          }}
        />
        <button
          type="submit"
          data-testid="todo-add"
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            fontWeight: "600",
            color: "#ffffff",
            backgroundColor: "#3182ce",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Add
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {currentTodos.length === 0 ? (
          <p style={{ textAlign: "center", color: "#718096", fontStyle: "italic" }}>
            No tasks yet. Add one above!
          </p>
        ) : (
          currentTodos.map((todo, index) => (
            <div
              key={index}
              data-testid="todo-item"
              style={{
                padding: "12px 16px",
                backgroundColor: "#f7fafc",
                borderRadius: "6px",
                border: "1px solid #edf2f7",
                color: "#2d3748",
                fontSize: "16px",
                wordBreak: "break-word"
              }}
            >
              {todo}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
