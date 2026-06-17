"use server";

import { serverAction } from "rwsdk/worker";
import { addTodo, toggleTodo, deleteTodo } from "./kv";

export const addTodoAction = serverAction(async (formData: FormData) => {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return;
  await addTodo(title);
});

export const toggleTodoAction = serverAction(async (formData: FormData) => {
  const id = formData.get("id") as string;
  if (!id) return;
  await toggleTodo(id);
});

export const deleteTodoAction = serverAction(async (formData: FormData) => {
  const id = formData.get("id") as string;
  if (!id) return;
  await deleteTodo(id);
});
