"use server";

import { serverAction } from "rwsdk/worker";
import { todos } from "./todosState";

// Append a new todo from the submitted form data (`title=<string>`).
// Wrapping with `serverAction(...)` makes this a POST mutation that, after
// running, rehydrates and re-renders the page so the new todo appears.
export const addTodo = serverAction(async (formData: FormData) => {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  todos.push({ id: crypto.randomUUID(), title });
});

// Remove a todo by id from the submitted form data (`id=<string>`).
export const deleteTodo = serverAction(async (formData: FormData) => {
  const id = String(formData.get("id") ?? "");
  const index = todos.findIndex((t) => t.id === id);
  if (index !== -1) todos.splice(index, 1);
});