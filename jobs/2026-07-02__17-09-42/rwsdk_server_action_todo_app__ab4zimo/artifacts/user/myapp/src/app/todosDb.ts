// Module-level in-memory store for todos. Persists across requests within
// the lifetime of a single worker isolate.
export type Todo = { id: string; title: string };

export const todos: Todo[] = [];

export function addTodoToDb(title: string): Todo | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const todo: Todo = { id: crypto.randomUUID(), title: trimmed };
  todos.push(todo);
  return todo;
}

export function removeTodoFromDb(id: string): boolean {
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  todos.splice(idx, 1);
  return true;
}

export function resetTodosInDb(): void {
  todos.length = 0;
}

export function listTodosFromDb(): Todo[] {
  return todos.map((t) => ({ id: t.id, title: t.title }));
}
