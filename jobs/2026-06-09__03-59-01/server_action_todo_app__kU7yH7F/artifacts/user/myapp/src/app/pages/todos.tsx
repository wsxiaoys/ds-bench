import React from "react";
import { getTodos } from "./todos.store";
import { addTodo, deleteTodo } from "./todos.actions";

export const TodosPage = () => {
  const todos = getTodos();

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Todos</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id} style={{ margin: "10px 0" }}>
            <span data-testid="todo-item">{todo.title}</span>
            <form action={deleteTodo} style={{ display: "inline", marginLeft: "10px" }}>
              <input type="hidden" name="id" value={todo.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addTodo}>
        <input type="text" name="title" required placeholder="What needs to be done?" />
        <button type="submit">Add Todo</button>
      </form>
    </div>
  );
};
