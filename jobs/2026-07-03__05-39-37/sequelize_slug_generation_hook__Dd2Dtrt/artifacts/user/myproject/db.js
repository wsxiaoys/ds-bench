const { Sequelize } = require('sequelize');

// Use SQLite as the database dialect with a local file
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

module.exports = sequelize;