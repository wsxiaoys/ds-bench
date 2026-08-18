import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

async function fetchTodos() {
  const res = await fetch('/api/todos');
  if (!res.ok) {
    throw new Error('Failed to fetch todos');
  }
  return res.json();
}

async function createTodo(text) {
  const res = await fetch('/api/todos', {
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

function App() {
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
      setText('');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    mutation.mutate(text);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Todo List</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <input
          id="todo-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What needs to be done?"
          style={{ padding: '8px', width: '250px', marginRight: '10px' }}
        />
        <button id="todo-submit" type="submit" style={{ padding: '8px 16px' }}>
          Add Todo
        </button>
      </form>

      {isLoading && <p>Loading todos...</p>}
      {isError && <p style={{ color: 'red' }}>Error: {error.message}</p>}

      {!isLoading && !isError && (
        <ul id="todo-list">
          {todos.map((todo) => (
            <li key={todo.id}>{todo.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
