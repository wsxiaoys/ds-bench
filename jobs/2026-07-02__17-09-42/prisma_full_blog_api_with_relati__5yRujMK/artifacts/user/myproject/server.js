const express = require("express");
const { PrismaClient } = require("./prisma/generated/prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

require("dotenv").config();

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());

// Create a user
app.post("/users", async (req, res) => {
  const { email, name } = req.body || {};
  if (!email || !name) {
    return res.status(400).json({ error: "email and name are required" });
  }
  const user = await prisma.user.create({
    data: { email, name },
  });
  res.status(201).json(user);
});

// Get published posts by a user, including comment count
app.get("/users/:id/posts", async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "invalid user id" });
  }
  const posts = await prisma.post.findMany({
    where: { authorId: userId, published: true },
    include: {
      _count: {
        select: { comments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(posts);
});

// Create a post
app.post("/posts", async (req, res) => {
  const { title, content, authorId } = req.body || {};
  if (!title || !authorId) {
    return res.status(400).json({ error: "title and authorId are required" });
  }
  const post = await prisma.post.create({
    data: {
      title,
      content: content ?? null,
      authorId: parseInt(authorId, 10),
    },
  });
  res.status(201).json(post);
});

// Publish a post
app.patch("/posts/:id/publish", async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: "invalid post id" });
  }
  try {
    const post = await prisma.post.update({
      where: { id: postId },
      data: { published: true },
    });
    res.json(post);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "post not found" });
    }
    throw err;
  }
});

// Add a comment to a post
app.post("/posts/:id/comments", async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  const { body, authorId } = req.body || {};
  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: "invalid post id" });
  }
  if (!body || !authorId) {
    return res.status(400).json({ error: "body and authorId are required" });
  }
  const comment = await prisma.comment.create({
    data: {
      body,
      postId,
      authorId: parseInt(authorId, 10),
    },
  });
  res.status(201).json(comment);
});

// Get a post with author and comments
app.get("/posts/:id", async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: "invalid post id" });
  }
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: true,
      comments: {
        include: { author: true },
      },
    },
  });
  if (!post) {
    return res.status(404).json({ error: "post not found" });
  }
  res.json(post);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});