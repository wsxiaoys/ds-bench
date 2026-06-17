const { Router } = require('express');
const Article = require('../models/Article');

const router = Router();

// POST /articles — create a single article
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: '`title` is required and must be a string.' });
    }

    const article = await Article.create({ title });

    return res.status(201).json({
      id: article.id,
      title: article.title,
      slug: article.slug,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /articles/bulk — create multiple articles at once
router.post('/bulk', async (req, res) => {
  try {
    const items = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array of article objects.' });
    }

    for (const item of items) {
      if (!item.title || typeof item.title !== 'string') {
        return res.status(400).json({ error: 'Each item must have a `title` string.' });
      }
    }

    // bulkCreate triggers the beforeBulkCreate hook defined on the model,
    // which generates slugs for every instance in the batch.
    const articles = await Article.bulkCreate(items, { returning: true });

    return res.status(201).json(
      articles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
      }))
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
