"use server";

import { serverAction } from "rwsdk/worker";

export type Todo = {
  id: string;
  title: string;
};

const todos: Todo[] = [];

export const getTodos = (): Todo[] => {
  return [...todos];
};

export const resetTodos = (): void => {
  todos.length = 0;
};

export const addTodo = serverAction(async (title: string) => {
  const id = crypto.randomUUID();
  todos.push({ id, title });
  return { id, title };
});

export const deleteTodo = serverAction(async (id: string) => {
  const index = todos.findIndex((t) => t.id === id);
  if (index !== -1) {
    todos.splice(index, 1);
  }
});
