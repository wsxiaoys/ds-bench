import { env } from "cloudflare:workers";
import { TodoList } from "./TodoList";
import type { Todo } from "../actions";

export const Home = async () => {
  const list = await env.TODOS.list({ prefix: "todo:" });
  const todos: Todo[] = [];

  for (const key of list.keys) {
    const value = await env.TODOS.get(key.name);
    if (value) {
      todos.push(JSON.parse(value));
    }
  }

  todos.sort((a, b) => a.createdAt - b.createdAt);
  const remaining = todos.filter((t) => !t.done).length;

  return <TodoList todos={todos} remaining={remaining} />;
};