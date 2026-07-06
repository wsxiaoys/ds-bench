const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

const Company = sequelize.define('Company', {
  name: DataTypes.STRING
});

const Department = sequelize.define('Department', {
  name: DataTypes.STRING,
  status: DataTypes.STRING
});

const Employee = sequelize.define('Employee', {
  name: DataTypes.STRING,
  role: DataTypes.STRING
});

Company.hasMany(Department, { foreignKey: 'CompanyId' });
Department.belongsTo(Company, { foreignKey: 'CompanyId' });

Department.hasMany(Employee, { foreignKey: 'DepartmentId' });
Employee.belongsTo(Department, { foreignKey: 'DepartmentId' });

app.post('/seed', async (req, res) => {
  try {
    await sequelize.sync({ force: true });
    const data = req.body;
    if (Array.isArray(data)) {
      for (const companyData of data) {
        const departments = companyData.departments || [];
        const company = await Company.create({ name: companyData.name });
        for (const deptData of departments) {
          const employees = deptData.employees || [];
          const department = await Department.create({
            name: deptData.name,
            status: deptData.status,
            CompanyId: company.id
          });
          for (const empData of employees) {
            await Employee.create({
              name: empData.name,
              role: empData.role,
              DepartmentId: department.id
            });
          }
        }
      }
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

app.get('/companies/filtered', async (req, res) => {
  try {
    const companies = await Company.findAll({
      include: [{
        model: Department,
        required: false,
        where: { status: 'active' },
        include: [{
          model: Employee,
          required: false,
          where: { role: 'senior' }
        }]
      }]
    });
    const result = companies.map(c => {
      const company = c.toJSON();
      const departments = (company.Departments || []).map(d => {
        return {
          name: d.name,
          status: d.status,
          employees: (d.Employees || []).map(e => ({
            name: e.name,
            role: e.role
          }))
        };
      });
      return {
        name: company.name,
        departments: departments
      };
    });
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
