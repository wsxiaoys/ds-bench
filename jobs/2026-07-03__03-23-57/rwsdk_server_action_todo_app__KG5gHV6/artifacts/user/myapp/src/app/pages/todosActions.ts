"use server";

import { serverAction } from "rwsdk/worker";
import { addTodoItem, deleteTodoItem } from "../todosStore";

export const addTodo = serverAction(async (formData: FormData) => {
  const title = formData.get("title");
  if (typeof title === "string" && title.trim()) {
    addTodoItem(title.trim());
  }
});

export const deleteTodo = serverAction(async (formData: FormData) => {
  const id = formData.get("id");
  if (typeof id === "string") {
    deleteTodoItem(id);
  }
});
