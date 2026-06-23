const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// In-memory todos store
let todos = [];
let nextId = 1;

// API Routes
app.get("/api/todos", (_req, res) => {
  res.status(200).json(todos);
});

app.post("/api/todos", (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }
  const todo = { id: nextId++, text, completed: false };
  todos.push(todo);
  res.status(201).json(todo);
});

// Serve static frontend
app.use(express.static(path.join(__dirname, "client", "dist")));

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "client", "dist", "index.html"));
});

const PORT = 4821;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
