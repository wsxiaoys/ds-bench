const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

// Define Models
const Company = sequelize.define('Company', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  timestamps: false
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
}, {
  timestamps: false
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
}, {
  timestamps: false
});

// Define Associations
Company.hasMany(Department, { foreignKey: 'companyId', as: 'departments' });
Department.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Department.hasMany(Employee, { foreignKey: 'departmentId', as: 'employees' });
Employee.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });

// POST /seed endpoint
app.post('/seed', async (req, res) => {
  try {
    // Sync force: true resets the database and recreates the tables
    await sequelize.sync({ force: true });

    const seedData = req.body;
    if (!Array.isArray(seedData)) {
      return res.status(400).json({ error: 'Seed data must be an array of companies' });
    }

    // Insert nested data sequentially
    for (const companyData of seedData) {
      await Company.create(companyData, {
        include: [
          {
            model: Department,
            as: 'departments',
            include: [
              {
                model: Employee,
                as: 'employees'
              }
            ]
          }
        ]
      });
    }

    return res.status(200).json({ message: 'Database successfully synced and seeded' });
  } catch (error) {
    console.error('Error seeding database:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /companies/filtered endpoint
app.get('/companies/filtered', async (req, res) => {
  try {
    const companies = await Company.findAll({
      include: [
        {
          model: Department,
          as: 'departments',
          where: { status: 'active' },
          required: false, // Ensures companies without active departments are still returned
          include: [
            {
              model: Employee,
              as: 'employees',
              where: { role: 'senior' },
              required: false // Ensures departments without senior employees are still returned
            }
          ]
        }
      ]
    });

    // Map the results to match the exact JSON structure of the seed payload
    const cleanCompanies = companies.map(company => ({
      name: company.name,
      departments: (company.departments || []).map(dept => ({
        name: dept.name,
        status: dept.status,
        employees: (dept.employees || []).map(emp => ({
          name: emp.name,
          role: emp.role
        }))
      }))
    }));

    return res.status(200).json(cleanCompanies);
  } catch (error) {
    console.error('Error fetching filtered companies:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
