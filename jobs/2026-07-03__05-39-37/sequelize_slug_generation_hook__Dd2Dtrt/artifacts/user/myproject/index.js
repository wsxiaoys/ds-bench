const express = require('express');
const sequelize = require('./db');
const Article = require('./models/Article');

const app = express();
const PORT = 3000;

// Parse JSON request bodies
app.use(express.json());

// Create a single article
app.post('/articles', async (req, res) => {
  try {
    const { title } = req.body;

    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'A non-empty "title" string is required.' });
    }

    const article = await Article.create({ title });

    return res.status(201).json({
      id: article.id,
      title: article.title,
      slug: article.slug,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Create multiple articles in one request
app.post('/articles/bulk', async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be an array of objects with a "title".' });
    }

    // Validate every entry has a non-empty title
    const articles = req.body.map((item) => {
      if (typeof item.title !== 'string' || item.title.trim() === '') {
        throw new Error('Each item must have a non-empty "title" string.');
      }
      return { title: item.title };
    });

    // The beforeBulkCreate hook will populate slugs for all instances.
    const created = await Article.bulkCreate(articles);

    const result = created.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
    }));

    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Sync the database (using a fresh in-memory-style file) then start listening
sequelize
  .sync({ force: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Unable to sync database:', err);
    process.exit(1);
  });