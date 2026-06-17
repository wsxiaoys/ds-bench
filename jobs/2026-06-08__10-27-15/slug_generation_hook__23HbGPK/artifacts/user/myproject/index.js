const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

const Article = sequelize.define('Article', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  hooks: {
    beforeValidate: (article) => {
      if (article.title) {
        article.slug = article.title.toLowerCase().replace(/\s+/g, '-');
      }
    },
    beforeBulkCreate: (articles) => {
      for (const article of articles) {
        if (article.title) {
          article.slug = article.title.toLowerCase().replace(/\s+/g, '-');
        }
      }
    }
  }
});

app.post('/articles', async (req, res) => {
  try {
    const { title } = req.body;
    const article = await Article.create({ title });
    res.status(201).json({
      id: article.id,
      title: article.title,
      slug: article.slug
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/articles/bulk', async (req, res) => {
  try {
    const articlesData = req.body;
    const articles = await Article.bulkCreate(articlesData);
    res.status(201).json(articles.map(article => ({
      id: article.id,
      title: article.title,
      slug: article.slug
    })));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = 3000;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
