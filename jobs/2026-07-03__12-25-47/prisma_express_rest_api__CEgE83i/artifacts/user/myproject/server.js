const path = require('path');
// Load .env if DATABASE_URL isn't already set
if (!process.env.DATABASE_URL) {
  try {
    const fs = require('fs');
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/i);
        if (m) {
          process.env[m[1]] = m[2];
        }
      }
    }
  } catch (_) {}
}

const express = require('express');
const { PrismaClient } = require('./generated/prisma');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const sqlitePath = dbUrl.startsWith('file:') ? dbUrl.slice('file:'.length) : dbUrl;

const adapter = new PrismaBetterSqlite3({ url: sqlitePath });
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());

// POST /users - create a user
app.post('/users', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'email and name are required' });
    }
    const user = await prisma.user.create({
      data: { email, name },
    });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /tasks - create a task
app.post('/tasks', async (req, res) => {
  try {
    const { title, description, userId, priority } = req.body;
    if (!title || !userId) {
      return res.status(400).json({ error: 'title and userId are required' });
    }
    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? null,
        userId,
        ...(priority !== undefined ? { priority } : {}),
      },
    });
    res.status(201).json(task);
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /tasks - list all tasks, supports ?status and ?userId filters
app.get('/tasks', async (req, res) => {
  try {
    const { status, userId } = req.query;
    const where = {};
    if (status) where.status = String(status);
    if (userId) where.userId = String(userId);
    const tasks = await prisma.task.findMany({ where });
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /tasks/:id - get a single task with user included
app.get('/tasks/:id', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /tasks/:id - update task fields
app.patch('/tasks/:id', async (req, res) => {
  try {
    const { title, description, status, priority } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data,
    });
    res.json(task);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Task not found' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /tasks/:id - delete task, returns 204
app.delete('/tasks/:id', async (req, res) => {
  try {
    await prisma.task.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Task not found' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
