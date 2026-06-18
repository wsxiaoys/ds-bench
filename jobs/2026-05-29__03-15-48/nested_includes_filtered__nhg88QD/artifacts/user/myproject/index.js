const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
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
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

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

Company.hasMany(Department, { as: 'departments' });
Department.belongsTo(Company);

Department.hasMany(Employee, { as: 'employees' });
Employee.belongsTo(Department);

app.post('/seed', async (req, res) => {
  try {
    await sequelize.sync({ force: true });
    
    const data = req.body;
    if (Array.isArray(data)) {
      for (const companyData of data) {
        const company = await Company.create({ name: companyData.name });
        
        if (companyData.departments && Array.isArray(companyData.departments)) {
          for (const deptData of companyData.departments) {
            const department = await Department.create({
              name: deptData.name,
              status: deptData.status,
              CompanyId: company.id,
            });
            
            if (deptData.employees && Array.isArray(deptData.employees)) {
              for (const empData of deptData.employees) {
                await Employee.create({
                  name: empData.name,
                  role: empData.role,
                  DepartmentId: department.id,
                });
              }
            }
          }
        }
      }
    }
    
    res.status(200).send('Seeded successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error seeding data');
  }
});

app.get('/companies/filtered', async (req, res) => {
  try {
    const companies = await Company.findAll({
      include: [
        {
          model: Department,
          as: 'departments',
          required: false,
          where: {
            status: 'active',
          },
          include: [
            {
              model: Employee,
              as: 'employees',
              required: false,
              where: {
                role: 'senior',
              },
            },
          ],
        },
      ],
    });
    res.status(200).json(companies);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching data');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await sequelize.sync();
  console.log(`Server is running on port ${PORT}`);
});
