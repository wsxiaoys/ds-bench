import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ── API helpers ────────────────────────────────────────────────────────────

async function fetchTodos() {
  const res = await fetch('/api/todos');
  if (!res.ok) throw new Error('Failed to fetch todos');
  return res.json();
}

async function createTodo(text) {
  const res = await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Failed to create todo');
  return res.json();
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '32px',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    marginBottom: '24px',
    color: '#0f172a',
    letterSpacing: '-0.5px',
  },
  form: {
    display: 'flex',
    gap: '10px',
    marginBottom: '28px',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  button: {
    padding: '10px 20px',
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
  },
  buttonDisabled: {
    background: '#a5b4fc',
    cursor: 'not-allowed',
  },
  list: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    fontSize: '0.95rem',
    color: '#334155',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#6366f1',
    flexShrink: 0,
  },
  status: {
    marginTop: '16px',
    fontSize: '0.85rem',
    color: '#64748b',
    textAlign: 'center',
  },
  error: {
    color: '#ef4444',
    fontSize: '0.85rem',
    marginTop: '8px',
  },
};

// ── Component ──────────────────────────────────────────────────────────────

export default function App() {
  const [inputValue, setInputValue] = useState('');
  const queryClient = useQueryClient();

  // Fetch todos
  const { data: todos = [], isLoading, isError } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  });

  // Create todo mutation
  const mutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      // Invalidate and refetch the todos list
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setInputValue('');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    mutation.mutate(text);
  }

  const isPending = mutation.isPending;

  return (
    <div style={styles.card}>
      <h1 style={styles.heading}>📝 Todo List</h1>

      {/* Add todo form */}
      <form style={styles.form} onSubmit={handleSubmit}>
        <input
          id="todo-input"
          style={styles.input}
          type="text"
          placeholder="What needs to be done?"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isPending}
          autoFocus
        />
        <button
          id="todo-submit"
          type="submit"
          style={{ ...styles.button, ...(isPending ? styles.buttonDisabled : {}) }}
          disabled={isPending}
        >
          {isPending ? 'Adding…' : 'Add'}
        </button>
      </form>

      {mutation.isError && (
        <p style={styles.error}>
          ⚠️ {mutation.error?.message ?? 'Something went wrong.'}
        </p>
      )}

      {/* Todo list */}
      {isLoading && <p style={styles.status}>Loading todos…</p>}
      {isError && <p style={{ ...styles.status, color: '#ef4444' }}>Failed to load todos.</p>}

      {!isLoading && !isError && (
        <>
          <ul id="todo-list" style={styles.list}>
            {todos.map((todo) => (
              <li key={todo.id} style={styles.item}>
                <span style={styles.dot} />
                {todo.text}
              </li>
            ))}
          </ul>
          {todos.length === 0 && (
            <p style={styles.status}>No todos yet — add one above!</p>
          )}
        </>
      )}
    </div>
  );
}
