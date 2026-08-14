"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

export const Home = () => {
  const [todos, setTodos] = useSyncedState<string[]>([], "todos");
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setTodos((prev) => [...(prev || []), trimmed]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAdd();
    }
  };

  const list = todos || [];

  return (
    <div style={{
      maxWidth: "500px",
      margin: "50px auto",
      padding: "30px",
      fontFamily: "'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
      color: "#333333"
    }}>
      <header style={{ textAlign: "center", marginBottom: "30px" }}>
        <h1 style={{
          fontSize: "2.5rem",
          fontWeight: 800,
          margin: "0 0 10px 0",
          background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Realtime To-Do
        </h1>
        <p style={{ color: "#666666", fontSize: "1rem", margin: 0 }}>
          Collaborate in realtime with others!
        </p>
      </header>

      <div style={{ display: "flex", gap: "10px", marginBottom: "25px" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="todo-input"
          placeholder="What needs to be done?"
          style={{
            flex: 1,
            padding: "12px 16px",
            fontSize: "1rem",
            border: "2px solid #e2e8f0",
            borderRadius: "8px",
            outline: "none",
            transition: "border-color 0.2s",
          }}
        />
        <button
          onClick={handleAdd}
          data-testid="todo-add"
          style={{
            padding: "12px 24px",
            fontSize: "1rem",
            fontWeight: 600,
            backgroundColor: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
        >
          Add
        </button>
      </div>

      <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
        {list.map((todo, index) => (
          <li
            key={index}
            data-testid="todo-item"
            style={{
              padding: "14px 16px",
              backgroundColor: "#f8fafc",
              border: "1px solid #f1f5f9",
              borderRadius: "8px",
              marginBottom: "10px",
              fontSize: "1rem",
              wordBreak: "break-word",
              display: "flex",
              alignItems: "center",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.01)"
            }}
          >
            {todo}
          </li>
        ))}
        {list.length === 0 && (
          <p style={{
            textAlign: "center",
            color: "#94a3b8",
            fontSize: "1rem",
            marginTop: "20px"
          }}>
            No tasks yet. Add one above!
          </p>
        )}
      </ul>
    </div>
  );
};
