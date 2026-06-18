const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "database.sqlite",
  logging: false,
});

const Article = sequelize.define(
  "Article",
  {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    hooks: {
      beforeValidate: (article) => {
        if (article.title) {
          article.slug = article.title.toLowerCase().trim().replace(/\s+/g, "-");
        }
      },
    },
  }
);

app.post("/articles", async (req, res) => {
  try {
    const { title } = req.body;
    const article = await Article.create({ title });
    res.status(201).json({
      id: article.id,
      title: article.title,
      slug: article.slug,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/articles/bulk", async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : [];
    const articles = await Article.bulkCreate(payload, {
      individualHooks: true,
      returning: true,
    });
    res.status(201).json(
      articles.map((article) => ({
        id: article.id,
        title: article.title,
        slug: article.slug,
      }))
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = 3000;

sequelize
  .sync()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Unable to connect to the database:", error);
  });
