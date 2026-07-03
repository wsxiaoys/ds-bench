"use client";

import React from "react";
import { addTodo, toggleTodo, deleteTodo } from "@/app/actions";

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
}

interface TodoAppClientProps {
  todos: Todo[];
  remaining: number;
}

export const TodoAppClient: React.FC<TodoAppClientProps> = ({
  todos,
  remaining,
}) => {
  return (
    <div style={{ maxWidth: "500px", margin: "40px REDACTED", padding: "20px", fontFamily: "system-ui, sans-serif", backgroundColor: "#f9f9f9", borderRadius: "8px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
      <h1 style={{ textAlign: "center", color: "#333", marginBottom: "30px" }}>RedwoodSDK Todo App</h1>

      <form action={addTodo} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          name="title"
          aria-label="New todo title"
          placeholder="What needs to be done?"
          required
          style={{ flex: 1, padding: "10px", fontSize: "16px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <button
          type="submit"
          style={{ padding: "10px 20px", fontSize: "16px", backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Add
        </button>
      </form>

      <div style={{ marginBottom: "20px", fontSize: "16px", color: "#666" }}>
        Remaining: <strong data-testid="remaining-count">{remaining}</strong>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {todos.map((todo) => (
          <li
            key={todo.id}
            data-done={todo.done ? "true" : "false"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px",
              borderBottom: "1px solid #eee",
              backgroundColor: todo.done ? "#f0f0f0" : "white",
              borderRadius: "4px",
              marginBottom: "8px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
              <form action={toggleTodo} style={{ display: "flex", alignItems: "center" }}>
                <input type="hidden" name="id" value={todo.id} />
                <input
                  type="checkbox"
                  name="done"
                  defaultChecked={todo.done}
                  aria-label={`Toggle ${todo.title}`}
                  onChange={(e) => {
                    e.currentTarget.form?.requestSubmit();
                  }}
                  style={{ width: "20px", height: "20px", cursor: "pointer" }}
                />
              </form>
              <span
                data-testid="todo-title"
                style={{
                  fontSize: "16px",
                  textDecoration: todo.done ? "line-through" : "none",
                  color: todo.done ? "#888" : "#333"
                }}
              >
                {todo.title}
              </span>
            </div>

            <form action={deleteTodo} style={{ display: "flex", alignItems: "center" }}>
              <input type="hidden" name="id" value={todo.id} />
              <button
                type="submit"
                aria-label={`Delete ${todo.title}`}
                style={{
                  padding: "6px 12px",
                  fontSize: "14px",
                  backgroundColor: "#ff4d4f",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
};
