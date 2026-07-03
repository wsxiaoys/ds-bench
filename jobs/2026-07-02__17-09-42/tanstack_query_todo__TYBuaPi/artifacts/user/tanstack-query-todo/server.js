import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4821;

// In-memory todo store
let todos = [];
let nextId = 1;

app.use(express.json());

// API: GET /api/todos
app.get('/api/todos', (req, res) => {
  res.status(200).json(todos);
});

// API: POST /api/todos
app.post('/api/todos', (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'Text is required' });
  }
  const todo = {
    id: nextId++,
    text: text.trim(),
    completed: false,
  };
  todos.push(todo);
  res.status(201).json(todo);
});

// Serve static React build
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA fallback: send index.html for any non-API route
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
