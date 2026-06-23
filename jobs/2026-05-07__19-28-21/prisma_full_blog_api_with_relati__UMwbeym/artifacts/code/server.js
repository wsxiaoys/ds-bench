const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

// POST /users — create user
app.post('/users', async (req, res) => {
  const { email, name } = req.body;
  try {
    const user = await prisma.user.create({
      data: { email, name },
    });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /users/:id/posts — get published posts by user (include comment count)
app.get('/users/:id/posts', async (req, res) => {
  const { id } = req.params;
  try {
    const posts = await prisma.post.findMany({
      where: {
        authorId: Number(id),
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

// POST /posts — create post
app.post('/posts', async (req, res) => {
  const { title, content, authorId } = req.body;
  try {
    const post = await prisma.post.create({
      data: { title, content, authorId },
    });
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /posts/:id/publish — set published: true
app.patch('/posts/:id/publish', async (req, res) => {
  const { id } = req.params;
  try {
    const post = await prisma.post.update({
      where: { id: Number(id) },
      data: { published: true },
    });
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /posts/:id/comments — add a comment
app.post('/posts/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { body, authorId } = req.body;
  try {
    const comment = await prisma.comment.create({
      data: {
        body,
        authorId,
        postId: Number(id),
      },
    });
    res.json(comment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /posts/:id — get post with author and comments included
app.get('/posts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const post = await prisma.post.findUnique({
      where: { id: Number(id) },
      include: {
        author: true,
        comments: true,
      },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
