const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite'
});

const Company = require('./Company')(sequelize);
const Department = require('./Department')(sequelize);
const Employee = require('./Employee')(sequelize);
const Project = require('./Project')(sequelize);
const EmployeeProject = require('./EmployeeProject')(sequelize);

// Company has many Departments (alias: divisions)
Company.hasMany(Department, { as: 'divisions', foreignKey: 'CompanyId' });
Department.belongsTo(Company, { foreignKey: 'CompanyId' });

// Department has many Employees (alias: staff)
Department.hasMany(Employee, { as: 'staff', foreignKey: 'DepartmentId' });
Employee.belongsTo(Department, { foreignKey: 'DepartmentId' });

// Employee belongs to many Projects through EmployeeProject (alias: assignments)
Employee.belongsToMany(Project, { through: EmployeeProject, as: 'assignments', foreignKey: 'EmployeeId' });
Project.belongsToMany(Employee, { through: EmployeeProject, foreignKey: 'ProjectId' });

module.exports = {
  sequelize,
  Company,
  Department,
  Employee,
  Project,
  EmployeeProject
};
