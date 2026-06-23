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
    beforeCreate: (article) => {
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
    const article = await Article.create({ title: req.body.title });
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
    
    // bulkCreate returns an array of instances, but they might not have the auto-incremented ID depending on the dialect.
    // However, SQLite should return the IDs if we don't specify anything weird, wait, SQLite in Sequelize bulkCreate might not return IDs.
    // Actually, Sequelize bulkCreate with SQLite doesn't return auto-increment IDs unless we fetch them or they are returned.
    // Wait, let's just return the instances mapped.
    // Let's test this behavior.
    
    res.status(201).json(articles.map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug
    })));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = 3000;

sequelize.sync({ force: true }).then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
