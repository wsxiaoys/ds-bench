'use strict';

const Company = require('./Company');
const Department = require('./Department');
const Employee = require('./Employee');

// Company -> Department (one-to-many)
Company.hasMany(Department, { foreignKey: 'CompanyId', as: 'departments' });
Department.belongsTo(Company, { foreignKey: 'CompanyId' });

// Department -> Employee (one-to-many)
Department.hasMany(Employee, { foreignKey: 'DepartmentId', as: 'employees' });
Employee.belongsTo(Department, { foreignKey: 'DepartmentId' });

module.exports = { Company, Department, Employee };
