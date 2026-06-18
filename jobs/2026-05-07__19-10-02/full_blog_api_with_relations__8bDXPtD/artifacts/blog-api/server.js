const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.post("/users", async (req, res) => {
  const { email, name } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: "email and name are required" });
  }

  try {
    const user = await prisma.user.create({
      data: { email, name },
    });

    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({ error: "Failed to create user" });
  }
});

app.get("/users/:id/posts", async (req, res) => {
  const userId = Number(req.params.id);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
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
      orderBy: { createdAt: "desc" },
    });

    return res.json(posts);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch posts" });
  }
});

app.post("/posts", async (req, res) => {
  const { title, content, authorId } = req.body;

  if (!title || !authorId) {
    return res.status(400).json({ error: "title and authorId are required" });
  }

  try {
    const post = await prisma.post.create({
      data: {
        title,
        content: content ?? null,
        authorId: Number(authorId),
      },
    });

    return res.status(201).json(post);
  } catch (error) {
    return res.status(500).json({ error: "Failed to create post" });
  }
});

app.patch("/posts/:id/publish", async (req, res) => {
  const postId = Number(req.params.id);

  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  try {
    const post = await prisma.post.update({
      where: { id: postId },
      data: { published: true },
    });

    return res.json(post);
  } catch (error) {
    return res.status(500).json({ error: "Failed to publish post" });
  }
});

app.post("/posts/:id/comments", async (req, res) => {
  const postId = Number(req.params.id);
  const { body, authorId } = req.body;

  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  if (!body || !authorId) {
    return res.status(400).json({ error: "body and authorId are required" });
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        body,
        postId,
        authorId: Number(authorId),
      },
    });

    return res.status(201).json(comment);
  } catch (error) {
    return res.status(500).json({ error: "Failed to add comment" });
  }
});

app.get("/posts/:id", async (req, res) => {
  const postId = Number(req.params.id);

  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  try {
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
      return res.status(404).json({ error: "Post not found" });
    }

    return res.json(post);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch post" });
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
