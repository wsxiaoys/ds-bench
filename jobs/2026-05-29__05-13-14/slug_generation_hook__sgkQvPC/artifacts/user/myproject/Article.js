const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const generateSlug = (article) => {
  if (article.title) {
    article.slug = article.title.toLowerCase().replace(/ /g, '-');
  }
};

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
    allowNull: false
  }
}, {
  hooks: {
    beforeValidate: generateSlug,
    beforeCreate: generateSlug
  }
});

module.exports = Article;
