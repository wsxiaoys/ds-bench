const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

// Helper function to generate slug
const generateSlug = (title) => {
  if (!title) return '';
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
};

// Define Article model
const Article = sequelize.define('Article', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: false,
  hooks: {
    beforeValidate: (article) => {
      if (article.title) {
        article.slug = generateSlug(article.title);
      }
    },
    beforeBulkCreate: (articles) => {
      for (const article of articles) {
        if (article.title) {
          article.slug = generateSlug(article.title);
        }
      }
    }
  }
});

// Sync database
sequelize.sync().then(() => {
  console.log('Database synced successfully.');
});

// API Endpoints
app.post('/articles', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const article = await Article.create({ title });
    return res.status(201).json(article);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/articles/bulk', async (req, res) => {
  try {
    const articlesData = req.body;
    if (!Array.isArray(articlesData)) {
      return res.status(400).json({ error: 'Request body must be an array' });
    }
    // Check if any item lacks a title
    for (const item of articlesData) {
      if (!item.title) {
        return res.status(400).json({ error: 'All articles must have a title' });
      }
    }
    const articles = await Article.bulkCreate(articlesData);
    return res.status(201).json(articles);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
