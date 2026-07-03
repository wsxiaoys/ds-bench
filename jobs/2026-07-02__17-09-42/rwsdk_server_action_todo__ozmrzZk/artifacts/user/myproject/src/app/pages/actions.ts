"use server";

import { serverAction } from "rwsdk/worker";

import { deleteTodo as deleteFromKV, getTodo, putTodo } from "@/app/todos";

export const addTodo = serverAction(async (formData: FormData) => {
  const rawTitle = formData.get("title");
  const title =
    typeof rawTitle === "string" ? rawTitle.trim() : "";
  if (!title) {
    return;
  }
  const todo = {
    id: crypto.randomUUID(),
    title,
    done: false,
    createdAt: Date.now(),
  };
  await putTodo(todo);
});

export const toggleTodo = serverAction(async (formData: FormData) => {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  const existing = await getTodo(id);
  if (!existing) return;
  // checkbox state when present means the user wants done=true.
  // when absent, toggle to false.
  const doneValue = formData.get("done");
  const nextDone =
    typeof doneValue === "string"
      ? doneValue === "on" || doneValue === "true" || doneValue === "1"
      : !existing.done;
  await putTodo({ ...existing, done: nextDone });
});

export const deleteTodoAction = serverAction(async (formData: FormData) => {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await deleteFromKV(id);
});
