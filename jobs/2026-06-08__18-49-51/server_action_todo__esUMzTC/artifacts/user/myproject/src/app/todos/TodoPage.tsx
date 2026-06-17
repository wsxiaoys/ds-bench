import { getTodos } from "./kv";
import { AddTodoForm } from "./AddTodoForm";
import { TodoCheckbox } from "./TodoCheckbox";
import { DeleteTodoForm } from "./DeleteTodoForm";

export async function TodoPage() {
  const todos = await getTodos();
  const remaining = todos.filter((t) => !t.done).length;

  return (
    <main>
      <h1>Todos</h1>

      <AddTodoForm />

      <p data-testid="remaining-count">{remaining}</p>

      <ul>
        {todos.map((todo) => (
          <li key={todo.id} data-done={todo.done ? "true" : "false"}>
            <TodoCheckbox id={todo.id} title={todo.title} done={todo.done} />
            <span data-testid="todo-title">{todo.title}</span>
            <DeleteTodoForm id={todo.id} title={todo.title} />
          </li>
        ))}
      </ul>
    </main>
  );
}
