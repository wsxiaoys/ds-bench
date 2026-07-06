'use strict';

module.exports = (sequelize, DataTypes) => {
  const Image = sequelize.define(
    'Image',
    {
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
    },
    {}
  );

  Image.associate = (models) => {
    Image.belongsTo(models.User, {
      foreignKey: 'imageableId',
      constraints: false,
      as: 'imageableUser',
    });
    Image.belongsTo(models.Product, {
      foreignKey: 'imageableId',
      constraints: false,
      as: 'imageableProduct',
    });
  };

  return Image;
};