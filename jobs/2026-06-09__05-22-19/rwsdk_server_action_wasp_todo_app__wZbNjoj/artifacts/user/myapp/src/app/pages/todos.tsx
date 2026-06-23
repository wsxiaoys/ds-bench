import { addTodo, deleteTodo } from "../actions";
import { todos } from "../todos";

export const TodosPage = () => {
  return (
    <div>
      <h1>Todos</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id} data-testid="todo-item">
            {todo.title}
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