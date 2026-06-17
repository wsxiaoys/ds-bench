export interface Todo {
  id: string;
  title: string;
}

let todos: Todo[] = [];

export function getTodos(): Todo[] {
  return todos;
}

export function addTodoItem(title: string): Todo {
  const newTodo: Todo = {
    id: crypto.randomUUID(),
    title,
  };
  todos.push(newTodo);
  return newTodo;
}

export function deleteTodoItem(id: string): void {
  todos = todos.filter((todo) => todo.id !== id);
}

export function resetTodos(): void {
  todos = [];
}
