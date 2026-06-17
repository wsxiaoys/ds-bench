"use client";

import { deleteTodoAction } from "./actions";

interface DeleteTodoFormProps {
  id: string;
  title: string;
}

export function DeleteTodoForm({ id, title }: DeleteTodoFormProps) {
  return (
    <form action={deleteTodoAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" aria-label={`Delete ${title}`}>
        Delete
      </button>
    </form>
  );
}
