import { todos } from "../todosStore";
import { addTodo, deleteTodo } from "./todosActions";

export const TodosPage = () => {
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Todo List</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id} style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span data-testid="todo-item">{todo.title}</span>
            <form action={deleteTodo} style={{ display: "inline" }}>
              <input type="hidden" name="id" value={todo.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <form action={addTodo} style={{ marginTop: "20px" }}>
        <input type="text" name="title" placeholder="New todo..." required />
        <button type="submit">Add Todo</button>
      </form>
    </div>
  );
};
