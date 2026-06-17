const { Sequelize, DataTypes, Model } = require('sequelize');
const fs = require('fs');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
  logging: false
});

class Company extends Model {}
Company.init({
  name: DataTypes.STRING
}, { sequelize, modelName: 'Company' });

class Department extends Model {}
Department.init({
  name: DataTypes.STRING
}, { sequelize, modelName: 'Department' });

class Employee extends Model {}
Employee.init({
  name: DataTypes.STRING
}, { sequelize, modelName: 'Employee' });

class Project extends Model {}
Project.init({
  name: DataTypes.STRING,
  status: DataTypes.STRING
}, { 
  sequelize, 
  modelName: 'Project',
  defaultScope: {
    where: {
      status: 'active'
    }
  }
});

class EmployeeProject extends Model {}
EmployeeProject.init({}, { sequelize, modelName: 'EmployeeProject' });

// Associations
Company.hasMany(Department, { as: 'divisions', foreignKey: 'companyId' });
Department.belongsTo(Company, { foreignKey: 'companyId' });

Department.hasMany(Employee, { as: 'staff', foreignKey: 'departmentId' });
Employee.belongsTo(Department, { foreignKey: 'departmentId' });

Employee.belongsToMany(Project, { through: EmployeeProject, as: 'assignments', foreignKey: 'employeeId' });
Project.belongsToMany(Employee, { through: EmployeeProject, foreignKey: 'projectId' });

async function run() {
  await sequelize.sync({ force: true });

  // Seeding
  const techCorp = await Company.create({ name: 'TechCorp' });
  const engineering = await Department.create({ name: 'Engineering', companyId: techCorp.id });
  const alice = await Employee.create({ name: 'Alice', departmentId: engineering.id });
  
  const project1 = await Project.create({ name: 'Project Alpha', status: 'active' });
  const project2 = await Project.create({ name: 'Project Beta', status: 'inactive' });
  
  await alice.addAssignments([project1, project2]);

  // Query
  const result = await Company.findOne({
    where: { name: 'TechCorp' },
    include: [{
      model: Department,
      as: 'divisions',
      include: [{
        model: Employee,
        as: 'staff',
        include: [{
          model: Project,
          as: 'assignments'
        }]
      }]
    }]
  });

  fs.writeFileSync('output.json', JSON.stringify(result, null, 2));
  console.log('Query result written to output.json');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
