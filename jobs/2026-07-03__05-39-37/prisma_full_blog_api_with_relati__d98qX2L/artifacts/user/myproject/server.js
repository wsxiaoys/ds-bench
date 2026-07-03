require("dotenv/config");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

// Configure the SQLite driver adapter from DATABASE_URL (e.g. "file:./dev.db")
const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = dbUrl.replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url: dbPath });

const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());

// POST /users — create user
app.post("/users", async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: "email and name are required" });
    }
    const user = await prisma.user.create({
      data: { email, name },
    });
    res.status(201).json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /users/:id/posts — get published posts by user (include comment count)
app.get("/users/:id/posts", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const posts = await prisma.post.findMany({
      where: { authorId: id, published: true },
      select: {
        id: true,
        title: true,
        content: true,
        published: true,
        authorId: true,
        createdAt: true,
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(posts);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /posts — create post (body: { title, content, authorId })
app.post("/posts", async (req, res) => {
  try {
    const { title, content, authorId } = req.body;
    if (!title || authorId == null) {
      return res
        .status(400)
        .json({ error: "title and authorId are required" });
    }
    const post = await prisma.post.create({
      data: {
        title,
        content: content ?? null,
        authorId: Number(authorId),
      },
    });
    res.status(201).json(post);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PATCH /posts/:id/publish — set published: true
app.patch("/posts/:id/publish", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const post = await prisma.post.update({
      where: { id },
      data: { published: true },
    });
    res.json(post);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /posts/:id/comments — add a comment (body: { body, authorId })
app.post("/posts/:id/comments", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const { body, authorId } = req.body;
    if (!body || authorId == null) {
      return res
        .status(400)
        .json({ error: "body and authorId are required" });
    }
    const comment = await prisma.comment.create({
      data: {
        body,
        postId,
        authorId: Number(authorId),
      },
    });
    res.status(201).json(comment);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /posts/:id — get post with author and comments included
app.get("/posts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: true,
        comments: { include: { author: true } },
      },
    });
    if (!post) {
      return res.status(404).json({ error: "post not found" });
    }
    res.json(post);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Blog API server running on port ${PORT}`);
});