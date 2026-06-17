const express = require('express');
const path = require('path');

const app = express();
const PORT = 4821;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

let todos = [];
let nextId = 1;

app.get('/api/todos', (req, res) => {
  res.status(200).json(todos);
});

app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  const newTodo = {
    id: nextId++,
    text: text || '',
    completed: false
  };
  todos.push(newTodo);
  res.status(201).json(newTodo);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});