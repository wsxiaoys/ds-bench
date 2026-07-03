const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// Helper that converts a title into a URL-friendly slug
function generateSlug(title) {
  return title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // spaces -> hyphens
    .replace(/[^\w-]+/g, ''); // remove non-word chars (keep hyphens/underscores)
}

const Article = sequelize.define(
  'Article',
  {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    hooks: {
      // Fires on individual Article.create() calls BEFORE validation runs,
      // so the slug is populated before the `allowNull: false` check occurs.
      beforeValidate: (article) => {
        if (article.title && !article.slug) {
          article.slug = generateSlug(article.title);
        }
      },
      // Fires on Article.bulkCreate() with the array of instances.
      // Individual hooks (like beforeValidate) do NOT run during bulkCreate
      // unless explicitly requested via `{ individualHooks: true }`, so we
      // handle the array here as well to cover both code paths.
      beforeBulkCreate: (articles) => {
        for (const article of articles) {
          if (article.title && !article.slug) {
            article.slug = generateSlug(article.title);
          }
        }
      },
    },
  }
);

module.exports = Article;