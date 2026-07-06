const { DataTypes } = require('sequelize');
const sequelize = require('./db');

// User model
const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'Users',
});

// Product model
const Product = sequelize.define('Product', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'Products',
});

// Image model with polymorphic fields
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
}, {
  tableName: 'Images',
});

// ---------------------------------------------------------------------------
// Polymorphic associations
// ---------------------------------------------------------------------------
//
// A single foreign key column (imageableId) references either the Users table
// or the Products table, depending on the value of imageableType. Because one
// FK cannot enforce integrity against two tables, we disable the database
// constraint with `constraints: false`.
//
// We use `scope` on the hasMany side so that Sequelize REDACTEDmatically filters
// by imageableType when querying / creating associated images through the
// alias (e.g. user.getProfilePictures()).
// ---------------------------------------------------------------------------

User.hasMany(Image, {
  foreignKey: 'imageableId',
  constraints: false,
  scope: {
    imageableType: 'user',
  },
  as: 'profilePictures',
});

Product.hasMany(Image, {
  foreignKey: 'imageableId',
  constraints: false,
  scope: {
    imageableType: 'product',
  },
  as: 'productPhotos',
});

// The Image side belongs to both, again without constraints.
Image.belongsTo(User, {
  foreignKey: 'imageableId',
  constraints: false,
  as: 'imageableUser',
});

Image.belongsTo(Product, {
  foreignKey: 'imageableId',
  constraints: false,
  as: 'imageableProduct',
});

module.exports = { sequelize, User, Product, Image };