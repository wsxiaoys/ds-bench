"use server";

import { serverAction } from "rwsdk/worker";

import {
  addTodoToDb,
  removeTodoFromDb,
} from "@/app/todosDb";

// Wrap the underlying mutation with `serverAction(...)` from `rwsdk/worker`.
// The form will POST to this endpoint (via the `__rsc_action_id` query
// parameter that React adds to the form's `action` URL). The rehydrated page
// will then reflect the new state.
export const addTodo = serverAction(async (formData: FormData) => {
  const title = String(formData.get("title") ?? "");
  addTodoToDb(title);
});

// Delete-by-id action. The button is rendered inside its own form with a
// hidden `id` input so that React's form action mechanism can encode the
// todo id as a form field.
export const deleteTodo = serverAction(async (formData: FormData) => {
  const id = String(formData.get("id") ?? "");
  if (id) {
    removeTodoFromDb(id);
  }
});
