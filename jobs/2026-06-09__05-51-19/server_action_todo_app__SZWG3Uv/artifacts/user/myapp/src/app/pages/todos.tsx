import { getTodos, addTodo, deleteTodo } from "./todos.actions";

export const Todos = async () => {
  const todos = getTodos();

  return (
    <div>
      <h1>Todo List</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id} data-testid="todo-item">
            <span>{todo.title}</span>
            <form action={deleteTodo} method="POST" style={{ display: "inline" }}>
              <input type="hidden" name="id" value={todo.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addTodo} method="POST">
        <input name="title" type="text" placeholder="Enter a todo..." />
        <button type="submit">Add Todo</button>
      </form>
    </div>
  );
};
