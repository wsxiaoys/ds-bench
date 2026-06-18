const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");

const app = express();
const PORT = 3000;

app.use(express.json());

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite",
  logging: false,
});

const Company = sequelize.define("Company", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Department = sequelize.define("Department", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Employee = sequelize.define("Employee", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

Company.hasMany(Department, { as: "departments" });
Department.belongsTo(Company);
Department.hasMany(Employee, { as: "employees" });
Employee.belongsTo(Department);

app.post("/seed", async (req, res) => {
  try {
    const companiesPayload = Array.isArray(req.body) ? req.body : [];

    await sequelize.sync({ force: true });

    for (const companyData of companiesPayload) {
      const departments = Array.isArray(companyData.departments)
        ? companyData.departments
        : [];
      const company = await Company.create({ name: companyData.name });

      for (const departmentData of departments) {
        const employees = Array.isArray(departmentData.employees)
          ? departmentData.employees
          : [];
        const department = await Department.create({
          name: departmentData.name,
          status: departmentData.status,
          CompanyId: company.id,
        });

        for (const employeeData of employees) {
          await Employee.create({
            name: employeeData.name,
            role: employeeData.role,
            DepartmentId: department.id,
          });
        }
      }
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/companies/filtered", async (req, res) => {
  try {
    const companies = await Company.findAll({
      include: [
        {
          model: Department,
          as: "departments",
          where: { status: "active" },
          required: false,
          include: [
            {
              model: Employee,
              as: "employees",
              where: { role: "senior" },
              required: false,
            },
          ],
        },
      ],
      order: [
        ["id", "ASC"],
        [{ model: Department, as: "departments" }, "id", "ASC"],
        [
          { model: Department, as: "departments" },
          { model: Employee, as: "employees" },
          "id",
          "ASC",
        ],
      ],
    });

    res.status(200).json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
