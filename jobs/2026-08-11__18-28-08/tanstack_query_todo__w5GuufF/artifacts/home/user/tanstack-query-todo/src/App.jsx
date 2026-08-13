import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function App() {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();

  // Fetch todos
  const { data: todos = [], isLoading, isError, error } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const response = await fetch('/api/todos');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    }
  });

  // Create todo mutation
  const mutation = useMutation({
    mutationFn: async (newTodoText) => {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: newTodoText }),
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setText('');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    mutation.mutate(text);
  };

  return (
    <div style={{ maxWidth: '500px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <h1>Todo List</h1>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          id="todo-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter todo text..."
          style={{ padding: '8px', width: '70%', marginRight: '10px' }}
        />
        <button
          type="submit"
          id="todo-submit"
          disabled={mutation.isPending}
          style={{ padding: '8px 16px' }}
        >
          {mutation.isPending ? 'Adding...' : 'Add'}
        </button>
      </form>

      {isLoading && <p>Loading todos...</p>}
      {isError && <p>Error loading todos: {error.message}</p>}

      <ul id="todo-list">
        {todos.map((todo) => (
          <li key={todo.id}>
            {todo.text}
          </li>
        ))}
      </ul>
    </div>
  );
}