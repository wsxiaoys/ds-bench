const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
const port = 3000;

app.use(express.json());

app.post("/users", async (req, res) => {
  const { email, name } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: "email and name are required" });
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
      },
    });

    return res.status(201).json(user);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "email already exists" });
    }

    return res.status(500).json({ error: "failed to create user" });
  }
});

app.post("/tasks", async (req, res) => {
  const { title, description, userId, priority } = req.body;

  if (!title || userId === undefined) {
    return res.status(400).json({ error: "title and userId are required" });
  }

  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId)) {
    return res.status(400).json({ error: "userId must be an integer" });
  }

  const parsedPriority =
    priority === undefined ? undefined : Number.parseInt(priority, 10);
  if (priority !== undefined && Number.isNaN(parsedPriority)) {
    return res.status(400).json({ error: "priority must be an integer" });
  }

  try {
    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? null,
        priority: parsedPriority,
        user: {
          connect: { id: parsedUserId },
        },
      },
    });

    return res.status(201).json(task);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "user not found" });
    }

    return res.status(500).json({ error: "failed to create task" });
  }
});

app.get("/tasks", async (req, res) => {
  const { status, userId } = req.query;
  const where = {};

  if (status) {
    where.status = String(status);
  }

  if (userId !== undefined) {
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId)) {
      return res.status(400).json({ error: "userId must be an integer" });
    }
    where.userId = parsedUserId;
  }

  try {
    const tasks = await prisma.task.findMany({ where });
    return res.json(tasks);
  } catch (error) {
    return res.status(500).json({ error: "failed to fetch tasks" });
  }
});

app.get("/tasks/:id", async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId)) {
    return res.status(400).json({ error: "task id must be an integer" });
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { user: true },
    });

    if (!task) {
      return res.status(404).json({ error: "task not found" });
    }

    return res.json(task);
  } catch (error) {
    return res.status(500).json({ error: "failed to fetch task" });
  }
});

app.patch("/tasks/:id", async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId)) {
    return res.status(400).json({ error: "task id must be an integer" });
  }

  const allowedFields = ["title", "description", "status", "priority"];
  const data = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      data[field] = req.body[field];
    }
  }

  if (data.priority !== undefined) {
    const parsedPriority = Number.parseInt(data.priority, 10);
    if (Number.isNaN(parsedPriority)) {
      return res.status(400).json({ error: "priority must be an integer" });
    }
    data.priority = parsedPriority;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "no valid fields to update" });
  }

  try {
    const task = await prisma.task.update({
      where: { id: taskId },
      data,
    });

    return res.json(task);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "task not found" });
    }

    return res.status(500).json({ error: "failed to update task" });
  }
});

app.delete("/tasks/:id", async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId)) {
    return res.status(400).json({ error: "task id must be an integer" });
  }

  try {
    await prisma.task.delete({ where: { id: taskId } });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "task not found" });
    }

    return res.status(500).json({ error: "failed to delete task" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
