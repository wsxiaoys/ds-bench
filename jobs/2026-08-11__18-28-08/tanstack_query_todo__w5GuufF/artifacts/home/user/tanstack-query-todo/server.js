import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 4821;

app.use(express.json());

// In-memory state
let todos = [];
let nextId = 1;

// API Endpoints
app.get('/api/todos', (req, res) => {
  res.status(200).json(todos);
});

app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required and must be a string' });
  }
  const newTodo = {
    id: nextId++,
    text: text,
    completed: false
  };
  todos.push(newTodo);
  res.status(201).json(newTodo);
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://127.0.0.1:${port}`);
});