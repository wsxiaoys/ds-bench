import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchTodos() {
  const res = await fetch("/api/todos");
  if (!res.ok) throw new Error("Failed to fetch todos");
  return res.json();
}

async function createTodo(text) {
  const res = await fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Failed to create todo");
  return res.json();
}

export default function App() {
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState("");

  const { data: todos = [], isLoading, isError, error } = useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
  });

  const mutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    mutation.mutate(trimmed, {
      onSuccess: () => setInputValue(""),
    });
  };

  return (
    <div>
      <h1>Todo List</h1>

      <form onSubmit={handleSubmit}>
        <input
          id="todo-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter a todo..."
        />
        <button id="todo-submit" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Adding..." : "Add"}
        </button>
      </form>

      {isLoading && <p>Loading...</p>}
      {isError && <p>Error: {error.message}</p>}

      <ul id="todo-list">
        {todos.map((todo) => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}
