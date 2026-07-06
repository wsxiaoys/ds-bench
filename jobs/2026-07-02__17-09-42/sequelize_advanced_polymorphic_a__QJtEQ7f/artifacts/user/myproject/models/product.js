'use strict';

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    'Product',
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {}
  );

  Product.associate = (models) => {
    Product.hasMany(models.Image, {
      foreignKey: 'imageableId',
      constraints: false,
      scope: { imageableType: 'product' },
      as: 'productPhotos',
    });
  };

  return Product;
};