const { Sequelize, DataTypes } = require('sequelize');

// Use SQLite with a file so data persists across requests.
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

const User = sequelize.define(
  'User',
  {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    paranoid: true,
    timestamps: true,
  }
);

const Post = sequelize.define(
  'Post',
  {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    paranoid: true,
    timestamps: true,
  }
);

// One-to-many association.
User.hasMany(Post, { foreignKey: 'UserId', as: 'posts' });
Post.belongsTo(User, { foreignKey: 'UserId', as: 'user' });

module.exports = { sequelize, User, Post };