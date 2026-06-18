const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
});

const Company = sequelize.define('Company', {
  name: DataTypes.STRING
});

const Department = sequelize.define('Department', {
  name: DataTypes.STRING
});

const Employee = sequelize.define('Employee', {
  name: DataTypes.STRING
});

const Project = sequelize.define('Project', {
  name: DataTypes.STRING,
  status: DataTypes.STRING
}, {
  defaultScope: {
    where: {
      status: 'active'
    }
  }
});

const EmployeeProject = sequelize.define('EmployeeProject', {});

Company.hasMany(Department, { as: 'divisions' });
Department.belongsTo(Company);

Department.hasMany(Employee, { as: 'staff' });
Employee.belongsTo(Department);

Employee.belongsToMany(Project, { through: EmployeeProject, as: 'assignments' });
Project.belongsToMany(Employee, { through: EmployeeProject });

async function run() {
  await sequelize.sync({ force: true });

  const techCorp = await Company.create({ name: 'TechCorp' });
  
  const engineering = await Department.create({ name: 'Engineering' });
  await techCorp.addDivision(engineering);
  
  const alice = await Employee.create({ name: 'Alice' });
  await engineering.addStaff(alice);
  
  const activeProject = await Project.create({ name: 'Project A', status: 'active' });
  const inactiveProject = await Project.create({ name: 'Project B', status: 'inactive' });
  
  await alice.addAssignment(activeProject);
  await alice.addAssignment(inactiveProject);

  const result = await Company.findOne({
    where: { name: 'TechCorp' },
    include: [
      {
        model: Department,
        as: 'divisions',
        include: [
          {
            model: Employee,
            as: 'staff',
            include: [
              {
                model: Project,
                as: 'assignments'
              }
            ]
          }
        ]
      }
    ]
  });

  fs.writeFileSync(path.join(__dirname, 'output.json'), JSON.stringify(result, null, 2));
}

run().catch(console.error);
