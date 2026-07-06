const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

// 1. Connect to SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
});

// 2. Define models
const Company = sequelize.define('Company', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

const Department = sequelize.define('Department', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

const Employee = sequelize.define('Employee', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

const Project = sequelize.define('Project', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  defaultScope: {
    where: {
      status: 'active'
    }
  }
});

const EmployeeProject = sequelize.define('EmployeeProject', {});

// 3. Establish associations
Company.hasMany(Department, { as: 'divisions', foreignKey: 'companyId' });
Department.belongsTo(Company, { foreignKey: 'companyId' });

Department.hasMany(Employee, { as: 'staff', foreignKey: 'departmentId' });
Employee.belongsTo(Department, { foreignKey: 'departmentId' });

Employee.belongsToMany(Project, { through: EmployeeProject, as: 'assignments', foreignKey: 'employeeId', otherKey: 'projectId' });
Project.belongsToMany(Employee, { through: EmployeeProject, foreignKey: 'projectId', otherKey: 'employeeId' });

async function run() {
  try {
    // Sync models
    await sequelize.sync({ force: true });

    // Seed sample data
    const company = await Company.create({ name: 'TechCorp' });

    const engineering = await Department.create({ name: 'Engineering', companyId: company.id });
    const marketing = await Department.create({ name: 'Marketing', companyId: company.id });

    const alice = await Employee.create({ name: 'Alice', departmentId: engineering.id });
    const bob = await Employee.create({ name: 'Bob', departmentId: engineering.id });
    const charlie = await Employee.create({ name: 'Charlie', departmentId: marketing.id });

    const projectAlpha = await Project.create({ name: 'Project Alpha', status: 'active' });
    const projectBeta = await Project.create({ name: 'Project Beta', status: 'inactive' });
    const projectGamma = await Project.create({ name: 'Project Gamma', status: 'active' });

    // Associate employees with projects using the junction table directly to ensure robustness
    await EmployeeProject.bulkCreate([
      { employeeId: alice.id, projectId: projectAlpha.id },
      { employeeId: alice.id, projectId: projectBeta.id },
      { employeeId: bob.id, projectId: projectGamma.id },
      { employeeId: charlie.id, projectId: projectAlpha.id },
      { employeeId: charlie.id, projectId: projectBeta.id }
    ]);

    // Perform query
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

    // Write result to output.json
    fs.writeFileSync(
      path.join(__dirname, 'output.json'),
      JSON.stringify(result, null, 2),
      'utf8'
    );

    console.log('Successfully queried database and wrote output.json.');
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
