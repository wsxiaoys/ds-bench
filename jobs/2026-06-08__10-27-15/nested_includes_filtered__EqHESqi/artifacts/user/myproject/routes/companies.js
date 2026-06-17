'use strict';

const express = require('express');
const router = express.Router();
const sequelize = require('../db');
const { Company, Department, Employee } = require('../models');

/**
 * POST /seed
 *
 * Resets the database and seeds it with the provided nested payload:
 * [ { name, departments: [ { name, status, employees: [ { name, role } ] } ] } ]
 */
router.post('/seed', async (req, res) => {
  try {
    // Drop and recreate all tables in the correct order
    await sequelize.sync({ force: true });

    const companies = req.body;

    for (const companyData of companies) {
      const company = await Company.create({ name: companyData.name });

      if (Array.isArray(companyData.departments)) {
        for (const deptData of companyData.departments) {
          const department = await Department.create({
            name: deptData.name,
            status: deptData.status,
            CompanyId: company.id,
          });

          if (Array.isArray(deptData.employees)) {
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

    res.status(200).json({ message: 'Database seeded successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /companies/filtered
 *
 * Returns ALL companies with:
 *   - only departments where status = 'active'   (LEFT OUTER JOIN → companies with no
 *     active departments still appear with departments: [])
 *   - within those departments, only employees where role = 'senior'  (LEFT OUTER JOIN →
 *     active departments with no senior employees still appear with employees: [])
 */
router.get('/companies/filtered', async (req, res) => {
  try {
    const companies = await Company.findAll({
      include: [
        {
          model: Department,
          as: 'departments',
          where: { status: 'active' },
          // required: false → LEFT OUTER JOIN so companies with no active
          // departments are still returned (with an empty departments array)
          required: false,
          include: [
            {
              model: Employee,
              as: 'employees',
              where: { role: 'senior' },
              // required: false → LEFT OUTER JOIN so active departments with no
              // senior employees are still returned (with an empty employees array)
              required: false,
            },
          ],
        },
      ],
    });

    // Serialize to plain objects and shape them to match the seed payload structure
    const result = companies.map((company) => ({
      name: company.name,
      departments: (company.departments || []).map((dept) => ({
        name: dept.name,
        status: dept.status,
        employees: (dept.employees || []).map((emp) => ({
          name: emp.name,
          role: emp.role,
        })),
      })),
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
