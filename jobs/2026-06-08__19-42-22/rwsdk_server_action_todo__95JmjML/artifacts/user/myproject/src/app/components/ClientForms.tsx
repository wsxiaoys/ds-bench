"use client";

import React, { useRef } from "react";
import { addTodo, toggleTodo, deleteTodo } from "../actions.js";

export function AddTodoForm() {
  return (
    <form action={addTodo}>
      <input type="text" name="title" aria-label="New todo title" required />
      <button type="submit">Add</button>
    </form>
  );
}

export function ToggleTodoForm({ todo }: { todo: { id: string; title: string; done: boolean } }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form action={toggleTodo} ref={formRef}>
      <input type="hidden" name="id" value={todo.id} />
      <input
        type="checkbox"
        name="done"
        aria-label={`Toggle ${todo.title}`}
        defaultChecked={todo.done}
        onChange={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}

export function DeleteTodoForm({ todo }: { todo: { id: string; title: string } }) {
  return (
    <form action={deleteTodo}>
      <input type="hidden" name="id" value={todo.id} />
      <button type="submit" aria-label={`Delete ${todo.title}`}>Delete</button>
    </form>
  );
}
