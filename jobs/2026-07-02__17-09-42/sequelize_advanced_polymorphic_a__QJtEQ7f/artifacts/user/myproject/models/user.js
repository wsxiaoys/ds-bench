'use strict';

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {}
  );

  User.associate = (models) => {
    User.hasMany(models.Image, {
      foreignKey: 'imageableId',
      constraints: false,
      scope: { imageableType: 'user' },
      as: 'profilePictures',
    });
  };

  return User;
};