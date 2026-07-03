const { sequelize, User, Project, UserProject } = require('./models');

async function main() {
  await sequelize.sync();

  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'add') {
    const username = args[1];
    const projectName = args[2];
    const role = args[3];

    const [user] = await User.findOrCreate({ where: { username } });
    const [project] = await Project.findOrCreate({ where: { name: projectName } });

    await UserProject.findOrCreate({
      where: { UserId: user.id, ProjectId: project.id },
      defaults: { role }
    });

    console.log(`Success: ${username} added to ${projectName} as ${role}`);
  } else if (command === 'list') {
    const username = args[1];
    const user = await User.findOne({
      where: { username },
      include: {
        model: Project,
        through: { attributes: ['role'] }
      }
    });

    if (!user) {
      console.log(JSON.stringify([]));
      return;
    }

    const result = user.Projects.map(project => ({
      name: project.name,
      role: project.UserProject.role
    }));

    console.log(JSON.stringify(result, null, 2));
  }

  await sequelize.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
