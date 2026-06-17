const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const app = express();

// Initialize adapter with database URL
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
});

const prisma = new PrismaClient({ adapter });

const PORT = 3000;

// Middleware
app.use(express.json());

// POST /users — create user
app.post('/users', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// GET /users/:id/posts — get published posts by user (include comment count)
app.get('/users/:id/posts', async (req, res) => {
  try {
    const { id } = req.params;

    // First verify the user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get published posts with comment count
    const posts = await prisma.post.findMany({
      where: {
        authorId: id,
        published: true,
      },
      include: {
        _count: {
          select: { comments: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      user,
      posts: posts.map(post => ({
        id: post.id,
        title: post.title,
        content: post.content,
        published: post.published,
        createdAt: post.createdAt,
        commentCount: post._count.comments,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

// POST /posts — create post
app.post('/posts', async (req, res) => {
  try {
    const { title, content, authorId } = req.body;

    if (!title || !authorId) {
      return res.status(400).json({ error: 'Title and authorId are required' });
    }

    // Verify the author exists
    const author = await prisma.user.findUnique({
      where: { id: authorId },
    });

    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    const post = await prisma.post.create({
      data: {
        title,
        content: content || null,
        authorId,
      },
    });

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// PATCH /posts/:id/publish — set published: true
app.patch('/posts/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.update({
      where: { id },
      data: { published: true },
    });

    res.json(post);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.status(500).json({ error: 'Failed to publish post' });
  }
});

// POST /posts/:id/comments — add a comment
app.post('/posts/:id/comments', async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { body, authorId } = req.body;

    if (!body || !authorId) {
      return res.status(400).json({ error: 'Body and authorId are required' });
    }

    // Verify the post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Verify the author exists
    const author = await prisma.user.findUnique({
      where: { id: authorId },
    });

    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    const comment = await prisma.comment.create({
      data: {
        body,
        postId,
        authorId,
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// GET /posts/:id — get post with author and comments included
app.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});