const express = require('express');
const path = require('path');

const app = express();
const PORT = 4821;

// In-memory todo storage
let todos = [];
let nextId = 1;

// Middleware
app.use(express.json());

// API Routes
app.get('/api/todos', (req, res) => {
  res.json(todos);
});

app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }
  const todo = {
    id: nextId++,
    text: text.trim(),
    completed: false
  };
  todos.push(todo);
  res.status(201).json(todo);
});

// Serve static files from the built frontend
app.use(express.static(path.join(__dirname, 'dist')));

// For any non-API route, serve the frontend's index.html (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});