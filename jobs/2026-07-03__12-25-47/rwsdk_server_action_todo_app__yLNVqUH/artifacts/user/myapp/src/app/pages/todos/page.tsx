import { addTodo, deleteTodoForm, getTodos } from "./actions";

export const TodosPage = () => {
  const todos = getTodos();

  return (
    <div>
      <h1>Todos</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id} data-testid="todo-item">
            <span>{todo.title}</span>
            <form action={deleteTodoForm} style={{ display: "inline" }}>
              <input type="hidden" name="id" value={todo.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addTodo}>
        <input type="text" name="title" required />
        <button type="submit">Add Todo</button>
      </form>
    </div>
  );
};
