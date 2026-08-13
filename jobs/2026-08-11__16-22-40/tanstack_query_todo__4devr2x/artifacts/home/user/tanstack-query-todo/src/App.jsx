import { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

const queryClient = new QueryClient();

function TodoApp() {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();

  // Fetch todos
  const { data: todos = [], isLoading, error } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const response = await fetch('/api/todos');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
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
        throw new Error('Failed to create todo');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setText('');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    mutation.mutate(text);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Todo List</h1>
      
      <form onSubmit={handleSubmit}>
        <input
          id="todo-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter todo..."
          disabled={mutation.isPending}
        />
        <button id="todo-submit" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Adding...' : 'Add Todo'}
        </button>
      </form>

      {isLoading && <p>Loading todos...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}

      <ul id="todo-list">
        {todos.map((todo) => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TodoApp />
    </QueryClientProvider>
  );
}
