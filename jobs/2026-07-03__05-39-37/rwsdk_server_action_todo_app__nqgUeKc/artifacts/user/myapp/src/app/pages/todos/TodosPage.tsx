import { todos } from "./todosState";
import { addTodo, deleteTodo } from "./actions";

export function TodosPage() {
  return (
    <div>
      <h1>Todos</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <span data-testid="todo-item">{todo.title}</span>{" "}
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
}