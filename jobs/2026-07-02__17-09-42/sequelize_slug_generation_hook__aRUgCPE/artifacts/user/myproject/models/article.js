const { DataTypes } = require('sequelize');

/**
 * Generate a URL-friendly slug from a title.
 * - Lowercases the title
 * - Trims surrounding whitespace
 * - Replaces one or more whitespace characters with a single hyphen
 * - Strips any characters that are not lowercase alphanumeric or hyphen
 */
function generateSlug(title) {
  if (!title) return '';
  return String(title)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

module.exports = (sequelize) => {
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
      tableName: 'Articles',
    }
  );

  // Hook for SINGLE creates (`Article.create()`).
  // `beforeValidate` runs BEFORE validation, so the slug is set in time
  // for the NOT NULL / allowNull check on the `slug` column to pass.
  Article.addHook('beforeValidate', (article) => {
    if (article.title && !article.slug) {
      article.slug = generateSlug(article.title);
    }
  });

  // Hook for BULK creates (`Article.bulkCreate()`).
  // Sequelize does NOT fire per-instance hooks (including `beforeValidate`
  // and `beforeCreate`) during bulkCreate by default, even when
  // `individualHooks: true` is set - only `beforeBulkCreate` /
  // `afterBulkCreate` run reliably. So we set the slug here, on the array
  // of records, before they are inserted.
  Article.addHook('beforeBulkCreate', (articles) => {
    for (const article of articles) {
      if (article.title && !article.slug) {
        article.slug = generateSlug(article.title);
      }
    }
  });

  // Expose the slug helper so it can be reused (and so it is easy to
  // unit test in isolation if desired).
  Article.generateSlug = generateSlug;

  return Article;
};