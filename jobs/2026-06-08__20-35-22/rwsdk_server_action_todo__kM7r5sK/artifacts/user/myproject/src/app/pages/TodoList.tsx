"use client";

import { addTodo, toggleTodo, deleteTodo } from "../actions";
import type { Todo } from "../actions";

export function TodoList({
  todos,
  remaining,
}: {
  todos: Todo[];
  remaining: number;
}) {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <h1>Todos</h1>

      <form action={addTodo} style={{ marginBottom: 20 }}>
        <input
          type="text"
          name="title"
          aria-label="New todo title"
          required
          style={{ padding: "8px 12px", fontSize: 16 }}
        />
        <button type="submit" style={{ padding: "8px 16px", fontSize: 16 }}>
          Add
        </button>
      </form>

      {todos.length === 0 && <p>No todos yet. Add one above!</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {todos.map((todo) => (
          <li
            key={`${todo.id}-${todo.done}`}
            data-done={todo.done ? "true" : "false"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 0",
              borderBottom: "1px solid #eee",
            }}
          >
            <form action={toggleTodo} style={{ display: "inline", margin: 0 }}>
              <input type="hidden" name="id" value={todo.id} />
              <input
                type="checkbox"
                name="done"
                aria-label={`Toggle ${todo.title}`}
                defaultChecked={todo.done}
                onChange={(e) => e.target.form?.requestSubmit()}
              />
            </form>
            <span
              data-testid="todo-title"
              style={{
                flex: 1,
                textDecoration: todo.done ? "line-through" : "none",
                color: todo.done ? "#999" : "#000",
              }}
            >
              {todo.title}
            </span>
            <form action={deleteTodo} style={{ display: "inline", margin: 0 }}>
              <input type="hidden" name="id" value={todo.id} />
              <button
                type="submit"
                aria-label={`Delete ${todo.title}`}
                style={{ padding: "4px 8px" }}
              >
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>

      <p data-testid="remaining-count">{remaining} item{remaining !== 1 ? "s" : ""} remaining</p>
    </div>
  );
}