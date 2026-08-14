"use client";

import React, { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

export const Home = () => {
  const [todos, setTodos] = useSyncedState<string[]>([], "todo-list");
  const [inputValue, setInputValue] = useState("");

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    setTodos((prev) => [...(prev || []), text]);
    setInputValue("");
  };

  return (
    <div style={{
      maxWidth: "500px",
      margin: "60px auto",
      padding: "30px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
      border: "1px solid #eaeaea"
    }}>
      <h1 style={{
        fontSize: "28px",
        fontWeight: "700",
        color: "#111111",
        marginBottom: "8px",
        textAlign: "center"
      }}>
        Collaborative To-Do List
      </h1>
      <p style={{
        fontSize: "14px",
        color: "#666666",
        marginBottom: "24px",
        textAlign: "center"
      }}>
        Add items below. They will sync in real-time across all open clients!
      </p>

      <form onSubmit={handleAddTodo} style={{
        display: "flex",
        gap: "10px",
        marginBottom: "24px"
      }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="What needs to be done?"
          data-testid="todo-input"
          style={{
            flex: 1,
            padding: "12px 16px",
            fontSize: "16px",
            borderRadius: "8px",
            border: "1px solid #cccccc",
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => e.target.style.borderColor = "#0070f3"}
          onBlur={(e) => e.target.style.borderColor = "#cccccc"}
        />
        <button
          type="submit"
          data-testid="todo-add"
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            fontWeight: "600",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#0070f3",
            color: "white",
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#0051a8"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#0070f3"}
        >
          Add
        </button>
      </form>

      <ul style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
        {(todos || []).map((todo, index) => (
          <li
            key={index}
            data-testid="todo-item"
            style={{
              padding: "14px 18px",
              backgroundColor: "#f9f9f9",
              borderRadius: "8px",
              border: "1px solid #f0f0f0",
              fontSize: "16px",
              color: "#333333",
              wordBreak: "break-word",
              display: "flex",
              alignItems: "center"
            }}
          >
            {todo}
          </li>
        ))}
        {(!todos || todos.length === 0) && (
          <p style={{
            textAlign: "center",
            color: "#999999",
            fontSize: "14px",
            marginTop: "20px"
          }}>
            No tasks yet. Add one to get started!
          </p>
        )}
      </ul>
    </div>
  );
};
