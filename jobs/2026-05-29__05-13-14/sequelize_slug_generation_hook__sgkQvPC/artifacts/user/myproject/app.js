const express = require('express');
const sequelize = require('./database');
const Article = require('./Article');

const app = express();
app.use(express.json());

// Sync database
sequelize.sync();

// POST /articles - Create a single article
app.post('/articles', async (req, res) => {
  try {
    const article = await Article.create({ title: req.body.title });
    res.status(201).json(article);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /articles/bulk - Create multiple articles in bulk
app.post('/articles/bulk', async (req, res) => {
  try {
    const articles = await Article.bulkCreate(req.body, {
      individualHooks: true,
      validate: true
    });
    res.status(201).json(articles);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
