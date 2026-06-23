"use server";

import { serverAction } from "rwsdk/worker";
import { todos } from "./todos";

export const addTodo = serverAction(async (formData: FormData) => {
  const title = formData.get("title") as string;
  if (title) {
    todos.push({ id: crypto.randomUUID(), title });
  }
});

export const deleteTodo = serverAction(async (formData: FormData) => {
  const id = formData.get("id") as string;
  const index = todos.findIndex((t) => t.id === id);
  if (index !== -1) {
    todos.splice(index, 1);
  }
});