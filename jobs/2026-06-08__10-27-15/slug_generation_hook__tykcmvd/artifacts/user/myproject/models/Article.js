const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// Helper: convert a title string into a URL-friendly slug
function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
}

const Article = sequelize.define(
  'Article',
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
    timestamps: false,
    hooks: {
      // Fires before validation for a single record — ensures slug is set
      // before the notNull constraint is checked on the slug field.
      beforeValidate(article) {
        if (article.title) {
          article.slug = generateSlug(article.title);
        }
      },

      // Fires before a bulkCreate call.
      // Individual hooks (beforeValidate / beforeCreate) do NOT run during
      // bulkCreate by default, so we handle the whole batch here.
      beforeBulkCreate(articles) {
        for (const article of articles) {
          if (article.title) {
            article.slug = generateSlug(article.title);
          }
        }
      },
    },
  }
);

module.exports = Article;
