const express = require('express');
const { Sequelize } = require('sequelize');

const ArticleFactory = require('./models/article');

const app = express();
app.use(express.json());

// SQLite database via Sequelize. We disable SQL logging so the console
// output stays clean during normal operation.
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

const Article = ArticleFactory(sequelize);

// Shape the response to only include the fields we want to expose.
// (Keeps the API contract stable regardless of internal model changes.)
function toResponse(article) {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
  };
}

// POST /articles
// Body: { "title": "My First Article" }
// 201 -> { id, title, slug }
app.post('/articles', async (req, res) => {
  try {
    const { title } = req.body || {};

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'A non-empty "title" string is required' });
    }

    const article = await Article.create({ title });
    return res.status(201).json(toResponse(article));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /articles/bulk
// Body: [{ "title": "Another Post" }, { "title": "Bulk Insert Test" }]
// 201 -> [{ id, title, slug }, ...]
//
// IMPORTANT: by default Sequelize skips per-instance hooks during
// `bulkCreate` for performance reasons. Passing `individualHooks: true`
// makes the `beforeValidate` hook fire for every record so the slug is
// generated consistently with the single-create path.
app.post('/articles/bulk', async (req, res) => {
  try {
    const items = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array' });
    }

    const created = await Article.bulkCreate(items, { individualHooks: true });
    return res.status(201).json(created.map(toResponse));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Initialize the database schema, then start the HTTP server.
const PORT = 3000;

sequelize
  .sync()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });