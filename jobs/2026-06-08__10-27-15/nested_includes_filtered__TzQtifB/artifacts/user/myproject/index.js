const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
});

// Models
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
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

const Employee = sequelize.define('Employee', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Associations
Company.hasMany(Department, { as: 'departments' });
Department.belongsTo(Company);

Department.hasMany(Employee, { as: 'employees' });
Employee.belongsTo(Department);

// Endpoints
app.post('/seed', async (req, res) => {
  try {
    await sequelize.sync({ force: true });
    const companiesData = req.body;

    for (const companyData of companiesData) {
      const company = await Company.create({ name: companyData.name });
      if (companyData.departments) {
        for (const deptData of companyData.departments) {
          const department = await Department.create({
            name: deptData.name,
            status: deptData.status,
            CompanyId: company.id
          });
          if (deptData.employees) {
            for (const empData of deptData.employees) {
              await Employee.create({
                name: empData.name,
                role: empData.role,
                DepartmentId: department.id
              });
            }
          }
        }
      }
    }
    res.status(200).send('Database seeded successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error seeding database');
  }
});

app.get('/companies/filtered', async (req, res) => {
  try {
    const companies = await Company.findAll({
      include: [
        {
          model: Department,
          as: 'departments',
          where: { status: 'active' },
          required: false,
          include: [
            {
              model: Employee,
              as: 'employees',
              where: { role: 'senior' },
              required: false
            }
          ]
        }
      ]
    });
    res.status(200).json(companies);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching filtered companies');
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
