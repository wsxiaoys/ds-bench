import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4821;

const app = express();
app.use(express.json());

// ---- In-memory todo store ----
let todos = [];
let nextId = 1;

// ---- API routes ----
app.get('/api/todos', (req, res) => {
  res.status(200).json(todos);
});

app.post('/api/todos', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const todo = { id: nextId++, text, completed: false };
  todos.push(todo);
  res.status(201).json(todo);
});

// ---- Vite dev server as middleware (serves the React frontend) ----
const vite = await createViteServer({
  root: __dirname,
  server: { middlewareMode: true },
  appType: 'spa',
});

app.use(vite.middlewares);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});