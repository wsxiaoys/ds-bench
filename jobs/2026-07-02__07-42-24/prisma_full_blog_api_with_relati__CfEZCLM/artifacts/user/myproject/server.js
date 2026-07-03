const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const app = express();
app.use(express.json());

const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

// POST /users — create user
app.post('/users', async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: "Email and name are required" });
  }
  try {
    const user = await prisma.user.create({
      data: { email, name },
    });
    return res.status(201).json(user);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Email already exists" });
    }
    return res.status(500).json({ error: error.message });
  }
});

// GET /users/:id/posts — get published posts by user (include comment count)
app.get('/users/:id/posts', async (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  try {
    const posts = await prisma.post.findMany({
      where: {
        authorId: userId,
        published: true,
      },
      include: {
        _count: {
          select: { comments: true },
        },
      },
    });
    return res.status(200).json(posts);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /posts — create post (body: { title, content, authorId })
app.post('/posts', async (req, res) => {
  const { title, content, authorId } = req.body;
  if (!title || !authorId) {
    return res.status(400).json({ error: "Title and authorId are required" });
  }
  const parsedAuthorId = parseInt(authorId);
  if (isNaN(parsedAuthorId)) {
    return res.status(400).json({ error: "Invalid authorId" });
  }
  try {
    const post = await prisma.post.create({
      data: {
        title,
        content,
        authorId: parsedAuthorId,
      },
    });
    return res.status(201).json(post);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /posts/:id/publish — set published: true
app.patch('/posts/:id/publish', async (req, res) => {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) {
    return res.status(400).json({ error: "Invalid post ID" });
  }
  try {
    const post = await prisma.post.update({
      where: { id: postId },
      data: { published: true },
    });
    return res.status(200).json(post);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.status(500).json({ error: error.message });
  }
});

// POST /posts/:id/comments — add a comment (body: { body, authorId })
app.post('/posts/:id/comments', async (req, res) => {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) {
    return res.status(400).json({ error: "Invalid post ID" });
  }
  const { body, authorId } = req.body;
  if (!body || !authorId) {
    return res.status(400).json({ error: "Body and authorId are required" });
  }
  const parsedAuthorId = parseInt(authorId);
  if (isNaN(parsedAuthorId)) {
    return res.status(400).json({ error: "Invalid authorId" });
  }
  try {
    const comment = await prisma.comment.create({
      data: {
        body,
        postId,
        authorId: parsedAuthorId,
      },
    });
    return res.status(201).json(comment);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /posts/:id — get post with author and comments included
app.get('/posts/:id', async (req, res) => {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) {
    return res.status(400).json({ error: "Invalid post ID" });
  }
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: true,
        comments: true,
      },
    });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.status(200).json(post);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
