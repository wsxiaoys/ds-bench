'use strict';

const path = require('path');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

// ---------------------------------------------------------------------------
// Prisma v7 requires a driver adapter for SQLite.
// PrismaBetterSqlite3 accepts a config object with a `url` field (file: URI).
// ---------------------------------------------------------------------------
// DATABASE_URL="file:./dev.db" resolves relative to CWD (project root).
const DB_PATH = path.resolve(__dirname, 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${DB_PATH}` });
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Helper: parse an integer id from request params; returns null when invalid.
// ---------------------------------------------------------------------------
function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ===========================================================================
// Users
// ===========================================================================

/**
 * POST /users
 * Body: { email: string, name: string }
 */
app.post('/users', async (req, res) => {
  const { email, name } = req.body ?? {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: '`email` is required and must be a string.' });
  }
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: '`name` is required and must be a string.' });
  }

  try {
    const user = await prisma.user.create({ data: { email: email.trim(), name: name.trim() } });
    return res.status(201).json(user);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }
    console.error('POST /users error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ===========================================================================
// Tasks
// ===========================================================================

/**
 * POST /tasks
 * Body: { title: string, description?: string, userId: number, priority?: number }
 */
app.post('/tasks', async (req, res) => {
  const { title, description, userId, priority } = req.body ?? {};

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: '`title` is required and must be a string.' });
  }
  const parsedUserId = parseInt(userId, 10);
  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({ error: '`userId` is required and must be a positive integer.' });
  }

  const data = {
    title: title.trim(),
    userId: parsedUserId,
  };
  if (description !== undefined) data.description = String(description);
  if (priority !== undefined) {
    const p = parseInt(priority, 10);
    if (!Number.isFinite(p)) {
      return res.status(400).json({ error: '`priority` must be an integer.' });
    }
    data.priority = p;
  }

  try {
    const task = await prisma.task.create({ data, include: { user: true } });
    return res.status(201).json(task);
  } catch (err) {
    if (err.code === 'P2003' || err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found.' });
    }
    console.error('POST /tasks error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /tasks
 * Query: ?status=<string>&userId=<number>
 */
app.get('/tasks', async (req, res) => {
  const { status, userId } = req.query;

  const where = {};
  if (status) where.status = status;
  if (userId) {
    const uid = parseInt(userId, 10);
    if (!Number.isFinite(uid) || uid <= 0) {
      return res.status(400).json({ error: '`userId` query param must be a positive integer.' });
    }
    where.userId = uid;
  }

  try {
    const tasks = await prisma.task.findMany({
      where,
      include: { user: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return res.json(tasks);
  } catch (err) {
    console.error('GET /tasks error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /tasks/:id
 * Returns single task with user included.
 */
app.get('/tasks/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Task id must be a positive integer.' });
  }

  try {
    const task = await prisma.task.findUnique({ where: { id }, include: { user: true } });
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    return res.json(task);
  } catch (err) {
    console.error('GET /tasks/:id error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PATCH /tasks/:id
 * Body: any subset of { title, description, status, priority }
 */
app.patch('/tasks/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Task id must be a positive integer.' });
  }

  const { title, description, status, priority } = req.body ?? {};
  const data = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: '`title` must be a non-empty string.' });
    }
    data.title = title.trim();
  }
  if (description !== undefined) data.description = description === null ? null : String(description);
  if (status !== undefined) {
    if (typeof status !== 'string' || !status.trim()) {
      return res.status(400).json({ error: '`status` must be a non-empty string.' });
    }
    data.status = status.trim();
  }
  if (priority !== undefined) {
    const p = parseInt(priority, 10);
    if (!Number.isFinite(p)) {
      return res.status(400).json({ error: '`priority` must be an integer.' });
    }
    data.priority = p;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided.' });
  }

  try {
    const task = await prisma.task.update({ where: { id }, data, include: { user: true } });
    return res.json(task);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Task not found.' });
    }
    console.error('PATCH /tasks/:id error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * DELETE /tasks/:id
 * Returns 204 No Content on success.
 */
app.delete('/tasks/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Task id must be a positive integer.' });
  }

  try {
    await prisma.task.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Task not found.' });
    }
    console.error('DELETE /tasks/:id error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ===========================================================================
// Server start
// ===========================================================================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Task Management API running on http://localhost:${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
