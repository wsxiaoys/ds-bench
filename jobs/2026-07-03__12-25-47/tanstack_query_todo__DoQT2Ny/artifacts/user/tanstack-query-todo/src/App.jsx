import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = '/api/todos';

async function fetchTodos() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error('Network response was not ok');
  return res.json();
}

async function createTodo(text) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Network response was not ok');
  return res.json();
}

export default function App() {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();

  const { data: todos = [], isLoading, error } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  });

  const mutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    mutation.mutate(trimmed);
    setText('');
  };

  return (
    <div>
      <h1>Todo List</h1>
      <form onSubmit={handleSubmit}>
        <input
          id="todo-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter a todo"
        />
        <button id="todo-submit" type="submit" disabled={mutation.isPending}>
          Add
        </button>
      </form>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error loading todos</p>}
      <ul id="todo-list">
        {todos.map((todo) => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}
