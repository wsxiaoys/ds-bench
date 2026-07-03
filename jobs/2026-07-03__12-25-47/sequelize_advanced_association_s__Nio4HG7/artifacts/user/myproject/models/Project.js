const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Project = sequelize.define('Project', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active'
    }
  }, {
    defaultScope: {
      where: {
        status: 'active'
      }
    }
  });
  return Project;
};
