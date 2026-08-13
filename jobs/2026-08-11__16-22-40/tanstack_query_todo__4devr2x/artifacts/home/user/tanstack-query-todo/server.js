const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 4821;

app.use(express.json());

// Keep the backend state in-memory for simplicity
let todos = [];
let nextId = 1;

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
  const newTodo = {
    id: nextId++,
    text,
    completed: false
  };
  todos.push(newTodo);
  res.status(201).json(newTodo);
});

// Serve static files from the Vite build output
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA (Single Page Application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
