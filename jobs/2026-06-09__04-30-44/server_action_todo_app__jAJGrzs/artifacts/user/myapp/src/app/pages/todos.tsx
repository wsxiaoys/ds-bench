"use server";
import { serverAction } from "rwsdk/worker";

export const todos: { id: string; title: string }[] = [];

export const addTodo = serverAction(async (formData: FormData) => {
  const title = formData.get("title");
  if (typeof title === "string" && title.trim()) {
    todos.push({ id: crypto.randomUUID(), title: title.trim() });
  }
});

export const deleteTodo = serverAction(async (formData: FormData) => {
  const id = formData.get("id");
  if (typeof id === "string") {
    const index = todos.findIndex((t) => t.id === id);
    if (index !== -1) {
      todos.splice(index, 1);
    }
  }
});

export const Todos = () => {
  return (
    <div>
      <h1>Todos</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <span data-testid="todo-item">{todo.title}</span>
            <form action={deleteTodo} style={{ display: "inline" }}>
              <input type="hidden" name="id" value={todo.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addTodo}>
        <input name="title" />
        <button type="submit">Add Todo</button>
      </form>
    </div>
  );
};
