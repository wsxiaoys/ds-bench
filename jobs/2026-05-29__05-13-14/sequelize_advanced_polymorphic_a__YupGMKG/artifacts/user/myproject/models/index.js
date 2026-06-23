const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite'),
  logging: false,
});

const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Product = sequelize.define('Product', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Image = sequelize.define('Image', {
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  imageableId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  imageableType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// User has many Images (aliased as profilePictures)
User.hasMany(Image, {
  foreignKey: 'imageableId',
  constraints: false,
  scope: {
    imageableType: 'user',
  },
  as: 'profilePictures',
});

// Product has many Images (aliased as productPhotos)
Product.hasMany(Image, {
  foreignKey: 'imageableId',
  constraints: false,
  scope: {
    imageableType: 'product',
  },
  as: 'productPhotos',
});

// Image belongs to User (polymorphic)
Image.belongsTo(User, {
  foreignKey: 'imageableId',
  constraints: false,
  as: 'User',
  scope: {
    imageableType: 'user',
  },
});

// Image belongs to Product (polymorphic)
Image.belongsTo(Product, {
  foreignKey: 'imageableId',
  constraints: false,
  as: 'Product',
  scope: {
    imageableType: 'product',
  },
});

module.exports = { sequelize, User, Product, Image };