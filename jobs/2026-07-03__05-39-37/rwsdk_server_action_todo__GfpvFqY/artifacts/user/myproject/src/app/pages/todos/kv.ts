import { env } from "cloudflare:workers";
import type { Todo } from "./types";

const PREFIX = "todo:";

/**
 * Read all todos from the KV namespace, sorted by createdAt ascending.
 */
export async function getAllTodos(): Promise<Todo[]> {
  const list = await env.TODOS.list({ prefix: PREFIX });
  const todos: Todo[] = [];
  for (const key of list.keys) {
    const value = await env.TODOS.get(key.name);
    if (value) {
      todos.push(JSON.parse(value) as Todo);
    }
  }
  todos.sort((a, b) => a.createdAt - b.createdAt);
  return todos;
}

/**
 * Count the remaining (unchecked) todos.
 */
export async function getRemainingCount(): Promise<number> {
  const todos = await getAllTodos();
  return todos.filter((t) => !t.done).length;
}

/**
 * Create a new todo and persist it to KV.
 */
export async function createTodo(title: string): Promise<Todo> {
  const id = crypto.randomUUID();
  const todo: Todo = {
    id,
    title,
    done: false,
    createdAt: Date.now(),
  };
  await env.TODOS.put(PREFIX + id, JSON.stringify(todo));
  return todo;
}

/**
 * Toggle the done state of an existing todo.
 */
export async function setTodoDone(id: string, done: boolean): Promise<void> {
  const value = await env.TODOS.get(PREFIX + id);
  if (!value) return;
  const todo = JSON.parse(value) as Todo;
  todo.done = done;
  await env.TODOS.put(PREFIX + id, JSON.stringify(todo));
}

/**
 * Delete a todo from KV.
 */
export async function deleteTodo(id: string): Promise<void> {
  await env.TODOS.delete(PREFIX + id);
}