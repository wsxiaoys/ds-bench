import { todos } from "./store";
import { addTodo, deleteTodo } from "./actions";

export const TodosPage = () => {
  return (
    <div>
      <h1>Todos</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id} data-testid="todo-item">
            <span>{todo.title}</span>
            <form action={deleteTodo} style={{ display: "inline" }}>
              <input type="hidden" name="id" value={todo.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addTodo}>
        <input name="title" type="text" placeholder="New todo..." />
        <button type="submit">Add Todo</button>
      </form>
    </div>
  );
};
