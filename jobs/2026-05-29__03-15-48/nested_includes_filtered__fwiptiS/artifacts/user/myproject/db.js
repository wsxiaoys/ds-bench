const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

const Company = sequelize.define('Company', {
  name: { type: DataTypes.STRING, allowNull: false },
});

const Department = sequelize.define('Department', {
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false },
});

const Employee = sequelize.define('Employee', {
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: false },
});

Company.hasMany(Department, { foreignKey: 'CompanyId' });
Department.belongsTo(Company, { foreignKey: 'CompanyId' });

Department.hasMany(Employee, { foreignKey: 'DepartmentId' });
Employee.belongsTo(Department, { foreignKey: 'DepartmentId' });

module.exports = { sequelize, Company, Department, Employee };