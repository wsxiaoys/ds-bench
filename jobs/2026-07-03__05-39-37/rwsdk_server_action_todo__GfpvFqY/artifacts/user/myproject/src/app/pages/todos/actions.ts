"use server";

import { serverAction } from "rwsdk/worker";
import { createTodo, setTodoDone, deleteTodo } from "./kv";

/**
 * Add a new todo. Receives FormData from the <form action={addTodo}> submission.
 */
export const addTodo = serverAction(async (formData: FormData) => {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await createTodo(title);
});

/**
 * Toggle a todo's done state. The form contains a hidden `id` field and a
 * checkbox named `done` (present when checked, absent when unchecked).
 */
export const toggleTodo = serverAction(async (formData: FormData) => {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const done = formData.get("done") === "on";
  await setTodoDone(id, done);
});

/**
 * Delete a todo. The form contains a hidden `id` field.
 */
export const deleteTodoAction = serverAction(async (formData: FormData) => {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteTodo(id);
});