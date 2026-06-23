const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false,
});

const Company = sequelize.define('Company', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Department = sequelize.define('Department', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Employee = sequelize.define('Employee', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Project = sequelize.define(
  'Project',
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    defaultScope: {
      where: {
        status: 'active',
      },
    },
  }
);

const EmployeeProject = sequelize.define('EmployeeProject', {});

Company.hasMany(Department, { as: 'divisions', foreignKey: 'companyId' });
Department.belongsTo(Company, { foreignKey: 'companyId' });

Department.hasMany(Employee, { as: 'staff', foreignKey: 'departmentId' });
Employee.belongsTo(Department, { foreignKey: 'departmentId' });

Employee.belongsToMany(Project, {
  through: EmployeeProject,
  as: 'assignments',
  foreignKey: 'employeeId',
});
Project.belongsToMany(Employee, {
  through: EmployeeProject,
  foreignKey: 'projectId',
});

const seedData = async () => {
  const company = await Company.create({ name: 'TechCorp' });

  const engineering = await Department.create({
    name: 'Engineering',
    companyId: company.id,
  });
  const hr = await Department.create({
    name: 'HR',
    companyId: company.id,
  });

  const alice = await Employee.create({
    name: 'Alice',
    departmentId: engineering.id,
  });
  const bob = await Employee.create({
    name: 'Bob',
    departmentId: engineering.id,
  });
  const carol = await Employee.create({
    name: 'Carol',
    departmentId: hr.id,
  });

  const apollo = await Project.create({ name: 'Apollo', status: 'active' });
  const borealis = await Project.unscoped().create({
    name: 'Borealis',
    status: 'inactive',
  });
  const catalyst = await Project.create({ name: 'Catalyst', status: 'active' });

  await alice.addAssignments([apollo, borealis]);
  await bob.addAssignments([catalyst]);
  await carol.addAssignments([apollo]);
};

const run = async () => {
  await sequelize.sync({ force: true });
  await seedData();

  const company = await Company.findOne({
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

  const outputPath = path.join(__dirname, 'output.json');
  fs.writeFileSync(outputPath, JSON.stringify(company, null, 2));

  await sequelize.close();
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
