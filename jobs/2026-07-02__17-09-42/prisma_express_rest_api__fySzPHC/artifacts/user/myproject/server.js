// Load environment variables from .env
require("dotenv").config();

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

// Initialize Prisma client with the better-sqlite3 adapter (required by Prisma v7)
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---------- Error helpers ----------
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Health check ----------
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "task-management-api" });
});

// ---------- Users ----------
// POST /users — create user
app.post(
  "/users",
  asyncHandler(async (req, res) => {
    const { email, name } = req.body || {};

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }

    try {
      const user = await prisma.user.create({
        data: { email, name },
      });
      return res.status(201).json(user);
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(409).json({ error: "email already exists" });
      }
      throw err;
    }
  })
);

// ---------- Tasks ----------
// POST /tasks — create task
app.post(
  "/tasks",
  asyncHandler(async (req, res) => {
    const { title, description, userId, priority } = req.body || {};

    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    const data = {
      title,
      userId,
      ...(description !== undefined ? { description } : {}),
      ...(priority !== undefined ? { priority: Number(priority) } : {}),
    };

    const task = await prisma.task.create({ data });
    return res.status(201).json(task);
  })
);

// GET /tasks — list all tasks, supports ?status= and ?userId= filters
app.get(
  "/tasks",
  asyncHandler(async (req, res) => {
    const { status, userId } = req.query;

    const where = {};
    if (status) where.status = String(status);
    if (userId) where.userId = String(userId);

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return res.json(tasks);
  })
);

// GET /tasks/:id — get single task with user included
app.get(
  "/tasks/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!task) {
      return res.status(404).json({ error: "task not found" });
    }
    return res.json(task);
  })
);

// PATCH /tasks/:id — update task fields
app.patch(
  "/tasks/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, status, priority } = req.body || {};

    // Ensure task exists
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "task not found" });
    }

    const data = {};
    if (title !== undefined) {
      if (typeof title !== "string" || !title) {
        return res.status(400).json({ error: "title must be a non-empty string" });
      }
      data.title = title;
    }
    if (description !== undefined) {
      data.description = description;
    }
    if (status !== undefined) {
      data.status = String(status);
    }
    if (priority !== undefined) {
      data.priority = Number(priority);
    }

    const task = await prisma.task.update({
      where: { id },
      data,
    });
    return res.json(task);
  })
);

// DELETE /tasks/:id — delete task, returns 204
app.delete(
  "/tasks/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "task not found" });
    }
    await prisma.task.delete({ where: { id } });
    return res.status(204).send();
  })
);

// ---------- 404 handler ----------
app.use((req, res) => {
  res.status(404).json({ error: `route not found: ${req.method} ${req.path}` });
});

// ---------- Global error handler ----------
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "internal server error" });
});

// ---------- Start server ----------
const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Task management API listening on http://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = async (signal) => {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
