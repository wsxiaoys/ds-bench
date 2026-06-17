const express = require('express');
const { sequelize, Company, Department, Employee } = require('./db');

const app = express();
app.use(express.json());

// POST /seed - Clear and repopulate the database
app.post('/seed', async (req, res) => {
  try {
    await sequelize.sync({ force: true });

    const companies = req.body;

    for (const companyData of companies) {
      const company = await Company.create({ name: companyData.name });

      for (const deptData of companyData.departments || []) {
        const department = await Department.create({
          name: deptData.name,
          status: deptData.status,
          CompanyId: company.id,
        });

        for (const empData of deptData.employees || []) {
          await Employee.create({
            name: empData.name,
            role: empData.role,
            DepartmentId: department.id,
          });
        }
      }
    }

    res.status(200).json({ message: 'Database seeded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
          required: false, // LEFT OUTER JOIN - include companies without active departments
          include: [
            {
              model: Employee,
              where: { role: 'senior' },
              required: false, // LEFT OUTER JOIN - include departments without senior employees
            },
          ],
        },
      ],
    });

    const result = companies.map((company) => {
      const companyJson = company.toJSON();
      return {
        name: companyJson.name,
        departments: (companyJson.Departments || []).map((dept) => ({
          name: dept.name,
          status: dept.status,
          employees: (dept.Employees || []).map((emp) => ({
            name: emp.name,
            role: emp.role,
          })),
        })),
      };
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;