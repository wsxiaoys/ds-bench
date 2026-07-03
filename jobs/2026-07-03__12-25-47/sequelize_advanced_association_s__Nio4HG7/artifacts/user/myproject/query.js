const fs = require('fs');
const { Company, Department, Employee, Project, EmployeeProject, sequelize } = require('./models');

(async () => {
  try {
    // Sync all models (drop existing tables for a clean seed)
    await sequelize.sync({ force: true });

    // Seed sample data
    const techCorp = await Company.create({ name: 'TechCorp' });
    const otherCo = await Company.create({ name: 'OtherCo' });

    const engineering = await Department.create({ name: 'Engineering', CompanyId: techCorp.id });
    const marketing = await Department.create({ name: 'Marketing', CompanyId: techCorp.id });
    await Department.create({ name: 'Sales', CompanyId: otherCo.id });

    const alice = await Employee.create({ name: 'Alice', DepartmentId: engineering.id });
    const bob = await Employee.create({ name: 'Bob', DepartmentId: engineering.id });
    const carol = await Employee.create({ name: 'Carol', DepartmentId: marketing.id });

    // Use unscoped Project to create projects of any status
    const ProjectUnscoped = Project.unscoped();
    const projA = await ProjectUnscoped.create({ name: 'Project Alpha', status: 'active' });
    const projB = await ProjectUnscoped.create({ name: 'Project Beta', status: 'active' });
    const projC = await ProjectUnscoped.create({ name: 'Project Gamma', status: 'inactive' });

    // Create junction records directly. Use the unscoped Project to bypass default scope
    await EmployeeProject.create({ EmployeeId: alice.id, ProjectId: projA.id, role: 'Lead' });
    await EmployeeProject.create({ EmployeeId: alice.id, ProjectId: projC.id, role: 'Helper' }); // inactive - filtered out by default scope
    await EmployeeProject.create({ EmployeeId: bob.id, ProjectId: projB.id, role: 'Developer' });
    await EmployeeProject.create({ EmployeeId: carol.id, ProjectId: projA.id, role: 'Coordinator' });

    // Query: Find TechCorp, eagerly loading divisions -> staff -> assignments
    const company = await Company.findOne({
      where: { name: 'TechCorp' },
      include: [{
        association: 'divisions',
        include: [{
          association: 'staff',
          include: [{
            association: 'assignments'
          }]
        }]
      }]
    });

    const result = company.toJSON();
    fs.writeFileSync('output.json', JSON.stringify(result, null, 2));
    console.log('Wrote output.json');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
})();
