import { env } from "cloudflare:workers";

export type Todo = {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
};

const PREFIX = "todo:";

function getKV(): KVNamespace {
  return env.TODOS;
}

export async function listTodos(): Promise<Todo[]> {
  const kv = getKV();
  const result = await kv.list({ prefix: PREFIX });
  const todos: Todo[] = [];
  for (const key of result.keys) {
    const value = await kv.get(key.name);
    if (!value) continue;
    try {
      todos.push(JSON.parse(value) as Todo);
    } catch {
      // skip malformed entries
    }
  }
  todos.sort((a, b) => a.createdAt - b.createdAt);
  return todos;
}

export async function getTodo(id: string): Promise<Todo | null> {
  const kv = getKV();
  const value = await kv.get(PREFIX + id);
  if (!value) return null;
  try {
    return JSON.parse(value) as Todo;
  } catch {
    return null;
  }
}

export async function putTodo(todo: Todo): Promise<void> {
  const kv = getKV();
  await kv.put(PREFIX + todo.id, JSON.stringify(todo));
}

export async function deleteTodo(id: string): Promise<void> {
  const kv = getKV();
  await kv.delete(PREFIX + id);
}

export function remainingCount(todos: Todo[]): number {
  return todos.filter((t) => !t.done).length;
}
