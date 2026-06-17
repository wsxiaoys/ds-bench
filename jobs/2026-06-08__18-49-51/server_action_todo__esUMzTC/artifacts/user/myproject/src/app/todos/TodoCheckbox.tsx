"use client";

import { toggleTodoAction } from "./actions";

interface TodoCheckboxProps {
  id: string;
  title: string;
  done: boolean;
}

export function TodoCheckbox({ id, title, done }: TodoCheckboxProps) {
  return (
    <form action={toggleTodoAction}>
      <input type="hidden" name="id" value={id} />
      <input
        type="checkbox"
        name="done"
        aria-label={`Toggle ${title}`}
        defaultChecked={done}
        onChange={(e) => {
          const form = e.currentTarget.form;
          if (form) form.requestSubmit();
        }}
      />
    </form>
  );
}
