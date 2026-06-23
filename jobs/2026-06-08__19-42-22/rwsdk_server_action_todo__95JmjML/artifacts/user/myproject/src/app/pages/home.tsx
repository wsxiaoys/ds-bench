import React from "react";
import { env } from "cloudflare:workers";
import { AddTodoForm, ToggleTodoForm, DeleteTodoForm } from "../components/ClientForms.js";

type Todo = {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
};

export const Home = async () => {
  const list = await env.TODOS.list({ prefix: "todo:" });
  const todos: Todo[] = [];
  
  for (const key of list.keys) {
    const data = await env.TODOS.get(key.name);
    if (data) {
      todos.push(JSON.parse(data));
    }
  }

  todos.sort((a, b) => a.createdAt - b.createdAt);

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <main>
      <h1>Todos</h1>
      <div>
        Remaining: <span data-testid="remaining-count">{remaining}</span>
      </div>
      <AddTodoForm />
      <ul>
        {todos.map((todo) => (
          <li key={todo.id} data-done={todo.done ? "true" : "false"}>
            <ToggleTodoForm todo={todo} />
            <span data-testid="todo-title">{todo.title}</span>
            <DeleteTodoForm todo={todo} />
          </li>
        ))}
      </ul>
    </main>
  );
};
