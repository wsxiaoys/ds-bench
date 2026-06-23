import { env } from "cloudflare:workers";

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
}

const KV_PREFIX = "todo:";

function getKV(): KVNamespace {
  return (env as unknown as Env).TODOS;
}

export async function getTodos(): Promise<Todo[]> {
  const kv = getKV();
  const list = await kv.list({ prefix: KV_PREFIX });
  const todos = await Promise.all(
    list.keys.map(async (key) => {
      const value = await kv.get(key.name);
      return value ? (JSON.parse(value) as Todo) : null;
    }),
  );
  const validTodos = todos.filter((t): t is Todo => t !== null);
  return validTodos.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addTodo(title: string): Promise<void> {
  const kv = getKV();
  const id = crypto.randomUUID();
  const todo: Todo = {
    id,
    title,
    done: false,
    createdAt: Date.now(),
  };
  await kv.put(`${KV_PREFIX}${id}`, JSON.stringify(todo));
}

export async function toggleTodo(id: string): Promise<void> {
  const kv = getKV();
  const value = await kv.get(`${KV_PREFIX}${id}`);
  if (!value) return;
  const todo = JSON.parse(value) as Todo;
  todo.done = !todo.done;
  await kv.put(`${KV_PREFIX}${id}`, JSON.stringify(todo));
}

export async function deleteTodo(id: string): Promise<void> {
  const kv = getKV();
  await kv.delete(`${KV_PREFIX}${id}`);
}
