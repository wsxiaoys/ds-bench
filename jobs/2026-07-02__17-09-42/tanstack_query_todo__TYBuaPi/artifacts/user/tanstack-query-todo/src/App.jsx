import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/todos';

async function fetchTodos() {
  const res = await fetch(API_BASE);
  if (!res.ok) {
    throw new Error('Failed to fetch todos');
  }
  return res.json();
}

async function createTodo(text) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error('Failed to create todo');
  }
  return res.json();
}

export default function App() {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();

  const { data: todos = [], isLoading, isError, error } = useQuery({
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
    mutation.mutate(trimmed, {
      onSuccess: () => setText(''),
    });
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
          placeholder="Enter a new todo..."
          disabled={mutation.isPending}
        />
        <button id="todo-submit" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Adding...' : 'Add'}
        </button>
      </form>

      {isLoading && <p>Loading todos...</p>}
      {isError && <p style={{ color: 'red' }}>Error: {error.message}</p>}

      <ul id="todo-list">
        {todos.map((todo) => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}
