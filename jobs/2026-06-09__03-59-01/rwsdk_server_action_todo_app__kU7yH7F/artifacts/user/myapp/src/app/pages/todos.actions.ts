"use server";

import { serverAction } from "rwsdk/worker";
import { addTodoItem, deleteTodoItem } from "./todos.store";

export const addTodo = serverAction(async (titleOrFormData: string | FormData) => {
  if (typeof titleOrFormData === "string") {
    if (titleOrFormData.trim()) {
      addTodoItem(titleOrFormData.trim());
    }
  } else if (titleOrFormData && typeof titleOrFormData === "object" && "get" in titleOrFormData) {
    const title = titleOrFormData.get("title");
    if (typeof title === "string" && title.trim()) {
      addTodoItem(title.trim());
    }
  }
});

export const deleteTodo = serverAction(async (idOrFormData: string | FormData) => {
  if (typeof idOrFormData === "string") {
    deleteTodoItem(idOrFormData);
  } else if (idOrFormData && typeof idOrFormData === "object" && "get" in idOrFormData) {
    const id = idOrFormData.get("id");
    if (typeof id === "string") {
      deleteTodoItem(id);
    }
  }
});
