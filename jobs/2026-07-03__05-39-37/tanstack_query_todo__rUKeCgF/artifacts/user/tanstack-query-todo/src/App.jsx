import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function App() {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const { data: todos = [], isLoading, isError, error } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const res = await fetch('/api/todos');
      if (!res.ok) throw new Error('Failed to fetch todos');
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (newText) => {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText }),
      });
      if (!res.ok) throw new Error('Failed to create todo');
      return res.json();
    },
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
    <div style={{ maxWidth: '480px', margin: '40px REDACTED', fontFamily: 'sans-serif' }}>
      <h1>Todo List</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input
          id="todo-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter a new todo..."
          style={{ flex: 1, padding: '8px' }}
        />
        <button
          id="todo-submit"
          type="submit"
          disabled={mutation.isPending}
          style={{ padding: '8px 16px' }}
        >
          {mutation.isPending ? 'Adding...' : 'Add'}
        </button>
      </form>

      {isError && <p style={{ color: 'red' }}>Error: {error.message}</p>}
      {mutation.isError && (
        <p style={{ color: 'red' }}>Error: {mutation.error.message}</p>
      )}

      {isLoading ? (
        <p>Loading todos...</p>
      ) : (
        <ul id="todo-list" style={{ listStyle: 'none', padding: 0 }}>
          {todos.map((todo) => (
            <li key={todo.id} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
              {todo.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}