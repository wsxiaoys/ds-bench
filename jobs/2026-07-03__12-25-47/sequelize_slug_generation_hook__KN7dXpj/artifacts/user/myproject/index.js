const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: console.log
});

function generateSlug(title) {
  if (!title) return title;
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

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
      if (article.title && !article.slug) {
        article.slug = generateSlug(article.title);
      }
    },
    beforeCreate: (article) => {
      if (article.title && !article.slug) {
        article.slug = generateSlug(article.title);
      }
    },
    beforeBulkCreate: (articles) => {
      articles.forEach((article) => {
        if (article.title && !article.slug) {
          article.slug = generateSlug(article.title);
        }
      });
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/articles/bulk', async (req, res) => {
  try {
    const articles = await Article.bulkCreate(req.body, { individualHooks: true });
    res.status(201).json(articles.map(article => ({
      id: article.id,
      title: article.title,
      slug: article.slug
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;

sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
