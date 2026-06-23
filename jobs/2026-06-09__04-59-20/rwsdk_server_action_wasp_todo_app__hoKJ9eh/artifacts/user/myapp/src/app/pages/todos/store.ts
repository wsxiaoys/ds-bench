// Module-level in-memory store (persists for the lifetime of the worker instance)

export type Todo = {
  id: string;
  title: string;
};

export const todos: Todo[] = [];
