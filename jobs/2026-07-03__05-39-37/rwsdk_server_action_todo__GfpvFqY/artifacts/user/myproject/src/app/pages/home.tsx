import { getAllTodos } from "./todos/kv";
import { TodoApp } from "./todos/TodoApp";

export const Home = async () => {
  const todos = await getAllTodos();
  const remaining = todos.filter((t) => !t.done).length;
  return <TodoApp todos={todos} remaining={remaining} />;
};