import express from 'express';
import cors from 'cors';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 4821;

app.use(cors());
app.use(express.json());

// In-memory state for todos
interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

let todos: Todo[] = [
  { id: 1, text: 'Learn TanStack Query', completed: false },
  { id: 2, text: 'Build an awesome app', completed: false }
];
let nextId = 3;

// API Endpoints
// GET /api/todos
app.get('/api/todos', (req, res) => {
  res.status(200).json(todos);
});

// POST /api/todos
app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Text must be a string' });
  }

  const newTodo: Todo = {
    id: nextId++,
    text,
    completed: false
  };

  todos.push(newTodo);
  res.status(201).json(newTodo);
});

// Serve static frontend files from 'dist' directory
app.use(express.static(path.join(__dirname, '../dist')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
