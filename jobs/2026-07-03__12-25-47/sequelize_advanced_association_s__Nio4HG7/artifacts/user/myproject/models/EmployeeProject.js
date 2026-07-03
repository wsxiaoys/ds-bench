const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EmployeeProject = sequelize.define('EmployeeProject', {
    role: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {});
  return EmployeeProject;
};
