const sequelize = require('../db');
const Company = require('./Company');
const Department = require('./Department');
const Employee = require('./Employee');

// A Company has many Departments
Company.hasMany(Department, { foreignKey: 'CompanyId', as: 'departments' });
Department.belongsTo(Company, { foreignKey: 'CompanyId', as: 'company' });

// A Department has many Employees
Department.hasMany(Employee, { foreignKey: 'DepartmentId', as: 'employees' });
Employee.belongsTo(Department, { foreignKey: 'DepartmentId', as: 'department' });

module.exports = {
  sequelize,
  Company,
  Department,
  Employee,
};