import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 4821;

// In-memory store
let todos = [
  { id: 1, text: 'Learn TanStack Query', completed: false },
  { id: 2, text: 'Build a Todo App', completed: false },
];
let nextId = 3;

app.use(express.json());

// Serve static files from the Vite build output
app.use(express.static(join(__dirname, 'dist')));

// GET /api/todos – return all todos
app.get('/api/todos', (req, res) => {
  res.status(200).json(todos);
});

// POST /api/todos – create a new todo
app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }
  const todo = { id: nextId++, text: text.trim(), completed: false };
  todos.push(todo);
  res.status(201).json(todo);
});

// Fallback: serve the SPA index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
