const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Company = sequelize.define('Company', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {});
  return Company;
};
