const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = 3000;

// Middleware
app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// POST /users - create user
app.post('/users', async (req, res, next) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    next(error);
  }
});

// POST /tasks - create task
app.post('/tasks', async (req, res, next) => {
  try {
    const { title, description, userId, priority } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ error: 'Title and userId are required' });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        userId,
        priority: priority || 0,
      },
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

// GET /tasks - list all tasks with optional filters
app.get('/tasks', async (req, res, next) => {
  try {
    const { status, userId } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (userId) {
      where.userId = userId;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// GET /tasks/:id - get single task with user included
app.get('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});

// PATCH /tasks/:id - update task fields
app.patch('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        user: true,
      },
    });

    res.json(task);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Task not found' });
    }
    next(error);
  }
});

// DELETE /tasks/:id - delete task
app.delete('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.task.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Task not found' });
    }
    next(error);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('Prisma client disconnected');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  console.log('Prisma client disconnected');
  process.exit(0);
});