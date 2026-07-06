const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

// Set up Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// Define Company model
const Company = sequelize.define('Company', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Define Department model
const Department = sequelize.define('Department', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Define Employee model
const Employee = sequelize.define('Employee', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Define associations
Company.hasMany(Department, {
  foreignKey: 'CompanyId',
  onDelete: 'CASCADE',
});
Department.belongsTo(Company, {
  foreignKey: 'CompanyId',
});

Department.hasMany(Employee, {
  foreignKey: 'DepartmentId',
  onDelete: 'CASCADE',
});
Employee.belongsTo(Department, {
  foreignKey: 'DepartmentId',
});

// POST /seed - Populates the database with the provided nested data
app.post('/seed', async (req, res) => {
  try {
    // Reset the database
    await sequelize.sync({ force: true });

    const companies = req.body;
    if (!Array.isArray(companies)) {
      return res.status(400).json({ error: 'Payload must be an array of companies' });
    }

    // Insert each company along with its nested departments and employees
    for (const companyData of companies) {
      const company = await Company.create({ name: companyData.name });

      if (Array.isArray(companyData.departments)) {
        for (const departmentData of companyData.departments) {
          const department = await Department.create({
            name: departmentData.name,
            status: departmentData.status,
            CompanyId: company.id,
          });

          if (Array.isArray(departmentData.employees)) {
            for (const employeeData of departmentData.employees) {
              await Employee.create({
                name: employeeData.name,
                role: employeeData.role,
                DepartmentId: department.id,
              });
            }
          }
        }
      }
    }

    return res.status(200).json({ message: 'Database seeded successfully' });
  } catch (err) {
    console.error('Seed error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /companies/filtered - Returns companies with filtered nested associations
app.get('/companies/filtered', async (req, res) => {
  try {
    const companies = await Company.findAll({
      include: [
        {
          model: Department,
          where: { status: 'active' },
          required: false, // LEFT OUTER JOIN: include companies without active departments
          include: [
            {
              model: Employee,
              where: { role: 'senior' },
              required: false, // LEFT OUTER JOIN: include active departments without senior employees
            },
          ],
        },
      ],
    });

    // Format the response to match the seed payload structure
    const result = companies.map((company) => ({
      name: company.name,
      departments: (company.Departments || []).map((department) => ({
        name: department.name,
        status: department.status,
        employees: (department.Employees || []).map((employee) => ({
          name: employee.name,
          role: employee.role,
        })),
      })),
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error('Filter error:', err);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;