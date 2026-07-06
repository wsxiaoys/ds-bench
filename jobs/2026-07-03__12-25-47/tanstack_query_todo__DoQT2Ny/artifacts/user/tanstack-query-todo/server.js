import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4821;

app.use(express.json());

// In-memory todo store
let todos = [];
let nextId = 1;

// GET /api/todos
app.get('/api/todos', (req, res) => {
  res.status(200).json(todos);
});

// POST /api/todos
app.post('/api/todos', (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Invalid text' });
  }
  const todo = { id: nextId++, text, completed: false };
  todos.push(todo);
  res.status(201).json(todo);
});

// Serve static files from dist
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for non-API routes
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Frontend not built. Run "npm run build" first.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
