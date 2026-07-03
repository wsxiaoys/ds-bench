require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const app = express();
app.use(express.json());

// Initialize Prisma Client with SQLite Driver Adapter for Prisma 7
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

// POST /users — create user (body: { email, name })
app.post('/users', async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required and must be a string' });
    }
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required and must be a string' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const user = await prisma.user.create({
      data: { email, name }
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// POST /tasks — create task (body: { title, description, userId, priority })
app.post('/tasks', async (req, res, next) => {
  try {
    const { title, description, userId, priority } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required and must be a string' });
    }
    if (userId === undefined || userId === null) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      return res.status(400).json({ error: 'userId must be a valid number' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: parsedUserId } });
    if (!user) {
      return res.status(400).json({ error: `User with id ${parsedUserId} does not exist` });
    }

    const parsedPriority = priority !== undefined ? parseInt(priority, 10) : 0;
    if (isNaN(parsedPriority)) {
      return res.status(400).json({ error: 'priority must be a valid number' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description === null || description === undefined ? null : String(description),
        userId: parsedUserId,
        priority: parsedPriority,
        status: 'todo' // default to 'todo' as per schema
      }
    });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// GET /tasks — list all tasks, supports ?status=todo filter and ?userId=<id> filter
app.get('/tasks', async (req, res, next) => {
  try {
    const { status, userId } = req.query;
    const where = {};

    if (status !== undefined) {
      where.status = String(status);
    }

    if (userId !== undefined) {
      const parsedUserId = parseInt(userId, 10);
      if (isNaN(parsedUserId)) {
        return res.status(400).json({ error: 'userId query parameter must be a valid number' });
      }
      where.userId = parsedUserId;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// GET /tasks/:id — get single task with user included
app.get('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'id must be a valid number' });
    }

    const task = await prisma.task.findUnique({
      where: { id: parsedId },
      include: { user: true }
    });

    if (!task) {
      return res.status(404).json({ error: `Task with id ${parsedId} not found` });
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /tasks/:id — update task fields (body: any subset of title/description/status/priority)
app.patch('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'id must be a valid number' });
    }

    // Check if task exists
    const existingTask = await prisma.task.findUnique({ where: { id: parsedId } });
    if (!existingTask) {
      return res.status(404).json({ error: `Task with id ${parsedId} not found` });
    }

    const { title, description, status, priority } = req.body;
    const updateData = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }
      updateData.title = title;
    }

    if (description !== undefined) {
      updateData.description = description === null ? null : String(description);
    }

    if (status !== undefined) {
      if (typeof status !== 'string') {
        return res.status(400).json({ error: 'status must be a string' });
      }
      updateData.status = status;
    }

    if (priority !== undefined) {
      const parsedPriority = parseInt(priority, 10);
      if (isNaN(parsedPriority)) {
        return res.status(400).json({ error: 'priority must be a valid number' });
      }
      updateData.priority = parsedPriority;
    }

    const updatedTask = await prisma.task.update({
      where: { id: parsedId },
      data: updateData
    });

    res.json(updatedTask);
  } catch (err) {
    next(err);
  }
});

// DELETE /tasks/:id — delete task, returns 204
app.delete('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'id must be a valid number' });
    }

    // Check if task exists
    const existingTask = await prisma.task.findUnique({ where: { id: parsedId } });
    if (!existingTask) {
      return res.status(404).json({ error: `Task with id ${parsedId} not found` });
    }

    await prisma.task.delete({
      where: { id: parsedId }
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
