import express from 'express';
import path from 'path';

const app = express();
const PORT = 4821;

app.use(express.json());

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

// In-memory store for todos
let todos: Todo[] = [
  { id: 1, text: 'Learn TanStack Query', completed: false },
  { id: 2, text: 'Build a Todo App', completed: false }
];
let nextId = 3;

// GET /api/todos
app.get('/api/todos', (req, res) => {
  res.json(todos);
});

// POST /api/todos
app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required and must be a string' });
  }

  const newTodo: Todo = {
    id: nextId++,
    text: text.trim(),
    completed: false
  };

  todos.push(newTodo);
  res.status(201).json(newTodo);
});

// Serve Vite build static files
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
