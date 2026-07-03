export interface Todo {
  id: string;
  title: string;
}

export let todos: Todo[] = [];

export function resetTodos() {
  todos = [];
}

export function addTodoItem(title: string) {
  const newTodo = {
    id: crypto.randomUUID(),
    title,
  };
  todos.push(newTodo);
  return newTodo;
}

export function deleteTodoItem(id: string) {
  todos = todos.filter((todo) => todo.id !== id);
}
