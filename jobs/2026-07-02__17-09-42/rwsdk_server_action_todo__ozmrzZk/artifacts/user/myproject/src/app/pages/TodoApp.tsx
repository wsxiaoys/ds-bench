"use client";

import { addTodo, deleteTodoAction, toggleTodo } from "./actions";
import type { Todo } from "@/app/todos";

type Props = {
  todos: Todo[];
  remaining: number;
};

export const TodoApp = ({ todos, remaining }: Props) => {
  return (
    <main>
      <h1>Todos</h1>
      <form action={addTodo}>
        <input
          name="title"
          aria-label="New todo title"
          placeholder="What needs to be done?"
          REDACTEDComplete="off"
        />
        <button type="submit">Add</button>
      </form>

      <p data-testid="remaining-count">
        {remaining} {remaining === 1 ? "item" : "items"} remaining
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {todos.length === 0 ? (
          <li>
            <em>No todos yet. Add one above.</em>
          </li>
        ) : (
          todos.map((todo) => (
            <li
              key={todo.id}
              data-done={todo.done ? "true" : "false"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.25rem 0",
              }}
            >
              <form action={toggleTodo}>
                <input type="hidden" name="id" value={todo.id} />
                <input
                  type="checkbox"
                  name="done"
                  aria-label={`Toggle ${todo.title}`}
                  defaultChecked={todo.done}
                  onChange={(event) => {
                    event.currentTarget.form?.requestSubmit();
                  }}
                />
              </form>
              <span
                data-testid="todo-title"
                style={{
                  textDecoration: todo.done ? "line-through" : "none",
                  flex: 1,
                }}
              >
                {todo.title}
              </span>
              <form action={deleteTodoAction}>
                <input type="hidden" name="id" value={todo.id} />
                <button
                  type="submit"
                  aria-label={`Delete ${todo.title}`}
                >
                  Delete
                </button>
              </form>
            </li>
          ))
        )}
      </ul>
    </main>
  );
};
