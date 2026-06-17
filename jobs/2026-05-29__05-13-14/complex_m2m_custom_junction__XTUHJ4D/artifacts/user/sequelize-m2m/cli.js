const { sequelize, User, Project, UserProject } = require('./db');

const command = process.argv[2];

async function add(username, projectName, role) {
  await sequelize.sync();

  const [user] = await User.findOrCreate({ where: { username } });
  const [project] = await Project.findOrCreate({ where: { name: projectName } });

  await user.addProject(project, { through: { role } });

  console.log(`Success: ${username} added to ${projectName} as ${role}`);

  await sequelize.close();
}

async function list(username) {
  await sequelize.sync();

  const user = await User.findOne({ where: { username } });

  if (!user) {
    console.log(JSON.stringify([]));
    await sequelize.close();
    return;
  }

  const projects = await user.getProjects({
    joinTableAttributes: ['role'],
  });

  const result = projects.map((project) => ({
    name: project.name,
    role: project.UserProject.role,
  }));

  console.log(JSON.stringify(result));

  await sequelize.close();
}

if (command === 'add') {
  const username = process.argv[3];
  const projectName = process.argv[4];
  const role = process.argv[5];
  add(username, projectName, role);
} else if (command === 'list') {
  const username = process.argv[3];
  list(username);
}