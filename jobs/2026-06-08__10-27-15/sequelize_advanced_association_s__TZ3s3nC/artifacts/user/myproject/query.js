'use strict';

const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

// ─── 1. Connect to SQLite ───────────────────────────────────────────────────
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false,
});

// ─── 2. Model Definitions ───────────────────────────────────────────────────

const Company = sequelize.define('Company', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'companies',
  timestamps: false,
});

const Department = sequelize.define('Department', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  CompanyId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'departments',
  timestamps: false,
});

const Employee = sequelize.define('Employee', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  DepartmentId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'employees',
  timestamps: false,
});

const Project = sequelize.define('Project', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
}, {
  tableName: 'projects',
  timestamps: false,
  // Default scope: only return active projects automatically
  defaultScope: {
    where: { status: 'active' },
  },
});

const EmployeeProject = sequelize.define('EmployeeProject', {
  EmployeeId: { type: DataTypes.INTEGER, allowNull: false },
  ProjectId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'employee_projects',
  timestamps: false,
});

// ─── 3. Associations ────────────────────────────────────────────────────────

// Company has many Departments (alias: divisions)
Company.hasMany(Department, { as: 'divisions', foreignKey: 'CompanyId' });
Department.belongsTo(Company, { foreignKey: 'CompanyId' });

// Department has many Employees (alias: staff)
Department.hasMany(Employee, { as: 'staff', foreignKey: 'DepartmentId' });
Employee.belongsTo(Department, { foreignKey: 'DepartmentId' });

// Employee belongs to many Projects through EmployeeProject (alias: assignments)
Employee.belongsToMany(Project, {
  through: EmployeeProject,
  as: 'assignments',
  foreignKey: 'EmployeeId',
  otherKey: 'ProjectId',
});

// Project belongs to many Employees through EmployeeProject
Project.belongsToMany(Employee, {
  through: EmployeeProject,
  foreignKey: 'ProjectId',
  otherKey: 'EmployeeId',
});

// ─── 4. Main Script ─────────────────────────────────────────────────────────

async function main() {
  // Sync all models (force: true drops and recreates tables for a clean run)
  await sequelize.sync({ force: true });

  // ── Seed Data ──────────────────────────────────────────────────────────────
  // Companies
  const techCorp = await Company.create({ name: 'TechCorp' });
  const otherCo  = await Company.create({ name: 'OtherCo' });

  // Departments for TechCorp
  const engineering = await Department.create({ name: 'Engineering', CompanyId: techCorp.id });
  const marketing   = await Department.create({ name: 'Marketing',   CompanyId: techCorp.id });

  // Department for OtherCo
  const sales = await Department.create({ name: 'Sales', CompanyId: otherCo.id });

  // Employees
  const alice  = await Employee.create({ name: 'Alice',  DepartmentId: engineering.id });
  const bob    = await Employee.create({ name: 'Bob',    DepartmentId: engineering.id });
  const carol  = await Employee.create({ name: 'Carol',  DepartmentId: marketing.id });
  const dave   = await Employee.create({ name: 'Dave',   DepartmentId: sales.id });

  // Projects (mix of active and inactive)
  // Use Project.unscoped() so we can also create inactive projects freely
  const ProjectUnscoped = Project.unscoped();

  const alphaProject   = await ProjectUnscoped.create({ name: 'Alpha',   status: 'active' });
  const betaProject    = await ProjectUnscoped.create({ name: 'Beta',    status: 'active' });
  const gammaProject   = await ProjectUnscoped.create({ name: 'Gamma',   status: 'inactive' });
  const deltaProject   = await ProjectUnscoped.create({ name: 'Delta',   status: 'active' });

  // Assign projects to employees via junction table
  // Alice: Alpha (active), Gamma (inactive)
  await EmployeeProject.create({ EmployeeId: alice.id,  ProjectId: alphaProject.id });
  await EmployeeProject.create({ EmployeeId: alice.id,  ProjectId: gammaProject.id });

  // Bob: Beta (active), Delta (active)
  await EmployeeProject.create({ EmployeeId: bob.id,    ProjectId: betaProject.id });
  await EmployeeProject.create({ EmployeeId: bob.id,    ProjectId: deltaProject.id });

  // Carol: Alpha (active)
  await EmployeeProject.create({ EmployeeId: carol.id,  ProjectId: alphaProject.id });

  // Dave (OtherCo): Beta (active)
  await EmployeeProject.create({ EmployeeId: dave.id,   ProjectId: betaProject.id });

  // ── Query ──────────────────────────────────────────────────────────────────
  // Find TechCorp with nested: divisions → staff → assignments
  // The Project default scope will automatically filter to status = 'active'
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
                // Because Project has a defaultScope, only active projects are returned
                model: Project,
                as: 'assignments',
              },
            ],
          },
        ],
      },
    ],
  });

  // ── Output ─────────────────────────────────────────────────────────────────
  const outputPath = path.join(__dirname, 'output.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Query complete. Result written to ${outputPath}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
