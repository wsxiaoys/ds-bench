"use client";

import { addTodoAction } from "./actions";

export function AddTodoForm() {
  return (
    <form action={addTodoAction}>
      <input
        type="text"
        name="title"
        aria-label="New todo title"
        placeholder="What needs to be done?"
        required
      />
      <button type="submit">Add</button>
    </form>
  );
}
