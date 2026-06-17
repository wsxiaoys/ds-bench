const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const port = 3000;

app.use(express.json());

// POST /users — create user
app.post('/users', async (req, res) => {
  const { email, name } = req.body;
  try {
    const user = await prisma.user.create({
      data: { email, name },
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /tasks — create task
app.post('/tasks', async (req, res) => {
  const { title, description, userId, priority } = req.body;
  try {
    const task = await prisma.task.create({
      data: {
        title,
        description,
        userId: Number(userId),
        priority: priority !== undefined ? Number(priority) : undefined,
      },
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /tasks — list all tasks, supports ?status=todo filter and ?userId=<id> filter
app.get('/tasks', async (req, res) => {
  const { status, userId } = req.query;
  const where = {};
  if (status) {
    where.status = status;
  }
  if (userId) {
    where.userId = Number(userId);
  }

  try {
    const tasks = await prisma.task.findMany({
      where,
    });
    res.json(tasks);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /tasks/:id — get single task with user included
app.get('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const task = await prisma.task.findUnique({
      where: { id: Number(id) },
      include: { user: true },
    });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /tasks/:id — update task fields
app.patch('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority } = req.body;
  try {
    const task = await prisma.task.update({
      where: { id: Number(id) },
      data: {
        title,
        description,
        status,
        priority: priority !== undefined ? Number(priority) : undefined,
      },
    });
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /tasks/:id — delete task, returns 204
app.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.task.delete({
      where: { id: Number(id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
