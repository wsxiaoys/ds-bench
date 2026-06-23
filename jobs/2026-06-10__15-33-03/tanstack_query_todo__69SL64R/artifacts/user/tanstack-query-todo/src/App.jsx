import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function App() {
  const queryClient = useQueryClient();
  const [newTodo, setNewTodo] = useState('');

  // Fetch todos using useQuery
  const { data: todos = [], isLoading, error } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const response = await fetch('/api/todos');
      if (!response.ok) {
        throw new Error('Failed to fetch todos');
      }
      return response.json();
    }
  });

  // Create todo mutation
  const addTodoMutation = useMutation({
    mutationFn: async (text) => {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!response.ok) {
        throw new Error('Failed to add todo');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the todos query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setNewTodo('');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = newTodo.trim();
    if (text) {
      addTodoMutation.mutate(text);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Todo List</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input
          id="todo-input"
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Enter a new todo..."
          style={{ flex: 1, padding: '8px', fontSize: '16px' }}
        />
        <button
          id="todo-submit"
          type="submit"
          disabled={addTodoMutation.isPending}
          style={{ padding: '8px 16px', fontSize: '16px', cursor: 'pointer' }}
        >
          {addTodoMutation.isPending ? 'Adding...' : 'Add Todo'}
        </button>
      </form>

      {addTodoMutation.isError && (
        <p style={{ color: 'red' }}>Error adding todo: {addTodoMutation.error.message}</p>
      )}

      {isLoading ? (
        <p>Loading todos...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>Error loading todos: {error.message}</p>
      ) : (
        <ul id="todo-list" style={{ listStyle: 'none', padding: 0 }}>
          {todos.length === 0 ? (
            <li style={{ padding: '8px', color: '#888' }}>No todos yet. Add one above!</li>
          ) : (
            todos.map((todo) => (
              <li key={todo.id} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                {todo.text}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default App;