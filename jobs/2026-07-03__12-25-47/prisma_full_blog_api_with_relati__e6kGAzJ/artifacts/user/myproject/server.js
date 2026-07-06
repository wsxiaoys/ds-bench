const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });
const app = express();

app.use(express.json());

// POST /users - create user
app.post('/users', async (req, res) => {
  try {
    const { email, name } = req.body;
    const user = await prisma.user.create({
      data: { email, name },
    });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /users/:id/posts - get published posts by user (include comment count)
app.get('/users/:id/posts', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
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
    res.json(posts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /posts - create post
app.post('/posts', async (req, res) => {
  try {
    const { title, content, authorId } = req.body;
    const post = await prisma.post.create({
      data: {
        title,
        content,
        authorId,
      },
    });
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /posts/:id/publish - set published: true
app.patch('/posts/:id/publish', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const post = await prisma.post.update({
      where: { id },
      data: { published: true },
    });
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /posts/:id/comments - add a comment
app.post('/posts/:id/comments', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { body, authorId } = req.body;
    const comment = await prisma.comment.create({
      data: {
        body,
        postId,
        authorId,
      },
    });
    res.json(comment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /posts/:id - get post with author and comments included
app.get('/posts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: true,
        comments: true,
      },
    });
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
