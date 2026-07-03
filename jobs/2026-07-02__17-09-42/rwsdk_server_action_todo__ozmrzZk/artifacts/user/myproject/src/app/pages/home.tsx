import { listTodos, remainingCount } from "@/app/todos";

import { TodoApp } from "./TodoApp";

export const Home = async () => {
  const todos = await listTodos();
  const remaining = remainingCount(todos);

  return <TodoApp todos={todos} remaining={remaining} />;
};
