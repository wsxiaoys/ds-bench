const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Connect to SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false,
});

// Define Company model
const Company = sequelize.define('Company', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
});

// Define Department model
const Department = sequelize.define('Department', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  CompanyId: { type: DataTypes.INTEGER, allowNull: false },
});

// Define Employee model
const Employee = sequelize.define('Employee', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  DepartmentId: { type: DataTypes.INTEGER, allowNull: false },
});

// Define Project model with default scope for active projects
const Project = sequelize.define('Project', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false },
}, {
  defaultScope: {
    where: { status: 'active' },
  },
});

// Define EmployeeProject junction table
const EmployeeProject = sequelize.define('EmployeeProject', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  EmployeeId: { type: DataTypes.INTEGER, allowNull: false },
  ProjectId: { type: DataTypes.INTEGER, allowNull: false },
  role: { type: DataTypes.STRING },
});

// Set up associations
Company.hasMany(Department, { as: 'divisions', foreignKey: 'CompanyId' });
Department.belongsTo(Company, { foreignKey: 'CompanyId' });

Department.hasMany(Employee, { as: 'staff', foreignKey: 'DepartmentId' });
Employee.belongsTo(Department, { foreignKey: 'DepartmentId' });

Employee.belongsToMany(Project, { through: EmployeeProject, as: 'assignments', foreignKey: 'EmployeeId' });
Project.belongsToMany(Employee, { through: EmployeeProject, foreignKey: 'ProjectId' });

async function main() {
  try {
    // Sync models (force recreate to ensure clean state)
    await sequelize.sync({ force: true });

    // Seed data
    const company = await Company.create({ name: 'TechCorp' });

    const dept1 = await Department.create({ name: 'Engineering', CompanyId: company.id });
    const dept2 = await Department.create({ name: 'Marketing', CompanyId: company.id });

    const emp1 = await Employee.create({ name: 'Alice', DepartmentId: dept1.id });
    const emp2 = await Employee.create({ name: 'Bob', DepartmentId: dept1.id });
    const emp3 = await Employee.create({ name: 'Carol', DepartmentId: dept2.id });

    const proj1 = await Project.create({ name: 'Project Alpha', status: 'active' });
    const proj2 = await Project.create({ name: 'Project Beta', status: 'active' });
    const proj3 = await Project.create({ name: 'Project Gamma', status: 'inactive' });
    const proj4 = await Project.create({ name: 'Project Delta', status: 'active' });

    // Assign employees to projects
    await emp1.addAssignment(proj1, { through: { role: 'Lead' } });
    await emp1.addAssignment(proj3, { through: { role: 'Contributor' } }); // inactive project
    await emp2.addAssignment(proj2, { through: { role: 'Developer' } });
    await emp3.addAssignment(proj4, { through: { role: 'Manager' } });
    await emp3.addAssignment(proj3, { through: { role: 'Consultant' } }); // inactive project

    // Query: find TechCorp with nested divisions, staff, and assignments (only active)
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
                  as: 'assignments',
                },
              ],
            },
          ],
        },
      ],
    });

    // Convert to plain JSON and write to output.json
    const output = JSON.stringify(result, null, 2);
    fs.writeFileSync(path.join(__dirname, 'output.json'), output);
    console.log('Query result written to output.json');

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    await sequelize.close();
    process.exit(1);
  }
}

main();