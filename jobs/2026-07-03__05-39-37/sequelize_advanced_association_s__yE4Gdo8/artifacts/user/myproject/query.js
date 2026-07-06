const { Sequelize, DataTypes, Model } = require('sequelize');
const fs = require('fs');
const path = require('path');

// 1. Connect to SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false,
});

// Define models

const Company = sequelize.define('Company', {
  name: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'companies',
});

const Department = sequelize.define('Department', {
  name: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'departments',
});

const Employee = sequelize.define('Employee', {
  name: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'employees',
});

// Project with a default scope that only includes 'active' projects
const Project = sequelize.define('Project', {
  title: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
}, {
  tableName: 'projects',
  defaultScope: {
    where: { status: 'active' },
  },
  scopes: {
    active: { where: { status: 'active' } },
    all: {},
  },
});

// Junction table for Employee <-> Project (many-to-many)
const EmployeeProject = sequelize.define('EmployeeProject', {
  role: { type: DataTypes.STRING },
}, {
  tableName: 'employee_projects',
  timestamps: true,
});

// 2. Establish associations

// Company has many Departments (alias: divisions)
Company.hasMany(Department, { as: 'divisions', foreignKey: 'companyId' });
// Department belongs to Company
Department.belongsTo(Company, { foreignKey: 'companyId' });

// Department has many Employees (alias: staff)
Department.hasMany(Employee, { as: 'staff', foreignKey: 'departmentId' });
// Employee belongs to Department
Employee.belongsTo(Department, { foreignKey: 'departmentId' });

// Employee belongs to many Projects through EmployeeProject (alias: assignments)
Employee.belongsToMany(Project, {
  through: EmployeeProject,
  as: 'assignments',
  foreignKey: 'employeeId',
  otherKey: 'projectId',
});
// Project belongs to many Employees through EmployeeProject
Project.belongsToMany(Employee, {
  through: EmployeeProject,
  foreignKey: 'projectId',
  otherKey: 'employeeId',
});

async function main() {
  try {
    // 2. Sync the models (force to ensure clean state)
    await sequelize.sync({ force: true });

    // 3. Seed sample data
    const company = await Company.create({ name: 'TechCorp' });

    const engineering = await Department.create({ name: 'Engineering', companyId: company.id });
    const marketing = await Department.create({ name: 'Marketing', companyId: company.id });

    const alice = await Employee.create({ name: 'Alice', departmentId: engineering.id });
    const bob = await Employee.create({ name: 'Bob', departmentId: engineering.id });
    const carol = await Employee.create({ name: 'Carol', departmentId: marketing.id });

    // Create projects - some active, some inactive (to demonstrate scope)
    const projectAlpha = await Project.create({ title: 'Project Alpha', status: 'active' });
    const projectBeta = await Project.create({ title: 'Project Beta', status: 'active' });
    const projectGamma = await Project.create({ title: 'Project Gamma', status: 'archived' });
    const projectDelta = await Project.create({ title: 'Project Delta', status: 'on_hold' });

    // Assign projects to employees via the junction table
    await alice.addAssignments([projectAlpha, projectGamma]);
    await bob.addAssignments([projectBeta, projectDelta]);
    await carol.addAssignments([projectAlpha, projectBeta]);

    // 4. Perform a single query to find TechCorp, eagerly loading:
    //    divisions -> staff -> assignments (active projects only via default scope)
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

    // 5. Write the query result as JSON to output.json
    const jsonOutput = JSON.stringify(result, null, 2);
    fs.writeFileSync(path.join(__dirname, 'output.json'), jsonOutput);

    console.log('Query completed successfully. Output written to output.json');

    // Log a brief summary to verify scope is working
    const plain = result.get({ plain: true });
    plain.divisions.forEach((division) => {
      division.staff.forEach((employee) => {
        const activeTitles = employee.assignments.map((p) => p.title);
        console.log(`  ${employee.name} assignments: [${activeTitles.join(', ')}]`);
      });
    });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();