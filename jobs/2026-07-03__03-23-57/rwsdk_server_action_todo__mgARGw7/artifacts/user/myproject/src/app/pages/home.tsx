import { env } from "cloudflare:workers";
import { TodoAppClient, Todo } from "./TodoAppClient.js";

export const Home = async () => {
  const list = await env.TODOS.list({ prefix: "todo:" });
  const todos: Todo[] = [];
  for (const key of list.keys) {
    const val = await env.TODOS.get(key.name);
    if (val) {
      todos.push(JSON.parse(val));
    }
  }
  todos.sort((a, b) => a.createdAt - b.createdAt);

  const remaining = todos.filter((t) => !t.done).length;

  return <TodoAppClient todos={todos} remaining={remaining} />;
};
