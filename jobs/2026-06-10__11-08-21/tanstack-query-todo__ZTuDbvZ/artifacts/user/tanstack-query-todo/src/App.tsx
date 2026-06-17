import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export default function App() {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();

  // Fetch todos
  const { data: todos = [], isLoading, isError, error } = useQuery<Todo[]>({
    queryKey: ['todos'],
    queryFn: async () => {
      const res = await fetch('/api/todos');
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }
      return res.json();
    }
  });

  // Create todo mutation
  const mutation = useMutation({
    mutationFn: async (newTodoText: string) => {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: newTodoText }),
      });
      if (!res.ok) {
        throw new Error('Failed to create todo');
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch todos
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setText('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    mutation.mutate(text);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
      <h1>TanStack Query Todo List</h1>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          id="todo-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter todo text..."
          style={{ padding: '8px', width: '70%', marginRight: '8px' }}
        />
        <button
          type="submit"
          id="todo-submit"
          disabled={mutation.isPending}
          style={{ padding: '8px 16px' }}
        >
          {mutation.isPending ? 'Adding...' : 'Add Todo'}
        </button>
      </form>

      {isLoading && <p>Loading todos...</p>}
      {isError && <p style={{ color: 'red' }}>Error: {(error as Error).message}</p>}

      {!isLoading && !isError && (
        <ul id="todo-list">
          {todos.map((todo) => (
            <li key={todo.id}>
              {todo.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
