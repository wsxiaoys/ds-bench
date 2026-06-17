"use server";

import { serverAction } from "rwsdk/worker";
import { todos } from "./store";

export const addTodo = serverAction(async (formData: FormData) => {
  const title = formData.get("title");
  if (typeof title === "string" && title.trim()) {
    todos.push({ id: crypto.randomUUID(), title: title.trim() });
  }
});

export const deleteTodo = serverAction(async (formData: FormData) => {
  const id = formData.get("id");
  if (typeof id === "string") {
    const index = todos.findIndex((t) => t.id === id);
    if (index !== -1) {
      todos.splice(index, 1);
    }
  }
});
