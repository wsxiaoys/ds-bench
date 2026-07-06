import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export default function App() {
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState('');

  const { data: todos = [], isLoading, isError, error } = useQuery<Todo[]>({
    queryKey: ['todos'],
    queryFn: async () => {
      const res = await fetch('/api/todos');
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }
      return res.json();
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setInputText('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    mutation.mutate(inputText);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Todo List</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          id="todo-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter todo item"
          disabled={mutation.isPending}
          style={{ padding: '8px', marginRight: '8px', width: '250px' }}
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

      {isLoading && <div>Loading todos...</div>}
      {isError && <div style={{ color: 'red' }}>Error: {(error as Error).message}</div>}

      <ul id="todo-list">
        {todos.map((todo) => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}
