const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const UserProject = sequelize.define('UserProject', {
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'UserProjects',
});

module.exports = UserProject;
