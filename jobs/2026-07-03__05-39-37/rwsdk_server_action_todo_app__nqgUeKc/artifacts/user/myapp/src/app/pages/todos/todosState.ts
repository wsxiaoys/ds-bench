export type Todo = {
  id: string;
  title: string;
};

// Module-level in-memory store. Persists across requests within the same
// worker isolate. Cleared by `POST /todos.reset`.
export const todos: Todo[] = [];