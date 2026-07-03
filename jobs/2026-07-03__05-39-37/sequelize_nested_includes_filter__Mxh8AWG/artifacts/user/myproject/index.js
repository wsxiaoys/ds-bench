const express = require('express');
const { sequelize, Company, Department, Employee } = require('./models');

const app = express();
app.use(express.json());

// POST /seed
// Accepts a JSON payload to populate the database.
// Clears existing data via sync({ force: true }) and inserts nested data.
app.post('/seed', async (req, res) => {
  try {
    const companies = req.body;

    if (!Array.isArray(companies)) {
      return res.status(400).json({ error: 'Expected a JSON array of companies.' });
    }

    // Reset the database schema and data
    await sequelize.sync({ force: true });

    // Insert the nested data
    for (const companyData of companies) {
      const company = await Company.create({ name: companyData.name });

      const departments = companyData.departments || [];
      for (const departmentData of departments) {
        const department = await Department.create({
          name: departmentData.name,
          status: departmentData.status,
          CompanyId: company.id,
        });

        const employees = departmentData.employees || [];
        for (const employeeData of employees) {
          await Employee.create({
            name: employeeData.name,
            role: employeeData.role,
            DepartmentId: department.id,
          });
        }
      }
    }

    return res.status(200).json({ message: 'Database seeded successfully.' });
  } catch (error) {
    console.error('Seed error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /companies/filtered
// Returns all companies with their active departments, and within those
// active departments, only senior employees.
//
// CRITICAL: Companies without active departments MUST still be included
// (empty departments array). Active departments without senior employees
// MUST still be included (empty employees array).
//
// To achieve this, we use `required: false` on every include so that
// Sequelize performs LEFT OUTER JOINs instead of INNER JOINs. Without
// `required: false`, adding a `where` clause to an include defaults to
// an INNER JOIN which would filter out parent records with no matching
// children.
app.get('/companies/filtered', async (req, res) => {
  try {
    const companies = await Company.findAll({
      include: [
        {
          model: Department,
          as: 'departments',
          required: false, // LEFT OUTER JOIN: keep companies with no active departments
          where: {
            status: 'active',
          },
          include: [
            {
              model: Employee,
              as: 'employees',
              required: false, // LEFT OUTER JOIN: keep active depts with no senior employees
              where: {
                role: 'senior',
              },
            },
          ],
        },
      ],
    });

    // Serialize to match the seed payload structure
    const result = companies.map((company) => ({
      name: company.name,
      departments: (company.departments || []).map((department) => ({
        name: department.name,
        status: department.status,
        employees: (department.employees || []).map((employee) => ({
          name: employee.name,
          role: employee.role,
        })),
      })),
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error('Filter error:', error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;

sequelize.authenticate().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch((error) => {
  console.error('Unable to connect to the database:', error);
});