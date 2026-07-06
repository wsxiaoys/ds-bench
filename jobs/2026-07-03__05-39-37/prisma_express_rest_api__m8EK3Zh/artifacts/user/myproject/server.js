const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

// Prisma 7 requires a driver adapter — SQLite via better-sqlite3.
// The adapter accepts a config object whose `url` points at the SQLite file.
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const app = express();

// Middleware
app.use(express.json());

/**
 * Error handler for known Prisma errors.
 */
function handleError(res, err) {
  if (err && err.code === "P2002") {
    // Unique constraint violation
    return res.status(409).json({ error: "A record with this value already exists." });
  }
  if (err && err.code === "P2025") {
    // Record not found
    return res.status(404).json({ error: "Record not found." });
  }
  if (err && err.code === "P2003") {
    // Foreign key constraint violation
    return res.status(400).json({ error: "Referenced record does not exist." });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error." });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/**
 * POST /users
 * Create a new user.
 * Body: { email, name }
 */
app.post("/users", async (req, res) => {
  try {
    const { email, name } = req.body || {};

    if (!email || !name) {
      return res.status(400).json({ error: "`email` and `name` are required." });
    }

    const user = await prisma.user.create({
      data: { email, name },
    });

    return res.status(201).json(user);
  } catch (err) {
    return handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/**
 * POST /tasks
 * Create a new task.
 * Body: { title, description?, userId, priority? }
 */
app.post("/tasks", async (req, res) => {
  try {
    const { title, description, userId, priority } = req.body || {};

    if (!title || userId === undefined || userId === null) {
      return res
        .status(400)
        .json({ error: "`title` and `userId` are required." });
    }

    const data = {
      title,
      userId: Number(userId),
    };
    if (description !== undefined) data.description = description;
    if (priority !== undefined) data.priority = Number(priority);

    const task = await prisma.task.create({ data });
    return res.status(201).json(task);
  } catch (err) {
    return handleError(res, err);
  }
});

/**
 * GET /tasks
 * List all tasks. Optional filters: ?status=todo & ?userId=<id>
 */
app.get("/tasks", async (req, res) => {
  try {
    const { status, userId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (userId) where.userId = Number(userId);

    const tasks = await prisma.task.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json(tasks);
  } catch (err) {
    return handleError(res, err);
  }
});

/**
 * GET /tasks/:id
 * Get a single task with its user included.
 */
app.get("/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const task = await prisma.task.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    return res.json(task);
  } catch (err) {
    return handleError(res, err);
  }
});

/**
 * PATCH /tasks/:id
 * Update any subset of { title, description, status, priority }.
 */
app.patch("/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};

    const allowed = ["title", "description", "status", "priority"];
    const data = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        data[key] = key === "priority" ? Number(body[key]) : body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({ error: "No updatable fields provided." });
    }

    const task = await prisma.task.update({
      where: { id },
      data,
      include: { user: true },
    });

    return res.json(task);
  } catch (err) {
    return handleError(res, err);
  }
});

/**
 * DELETE /tasks/:id
 * Delete a task. Returns 204 on success.
 */
app.delete("/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.task.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Task management API listening on port ${PORT}`);
});

async function shutdown() {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = app;