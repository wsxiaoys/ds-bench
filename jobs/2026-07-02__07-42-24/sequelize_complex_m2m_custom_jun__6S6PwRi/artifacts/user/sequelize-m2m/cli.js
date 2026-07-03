const { sequelize, User, Project, UserProject } = require('./db');

async function main() {
  await sequelize.sync();

  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'add') {
    const username = args[1];
    const projectName = args[2];
    const role = args[3];

    if (!username || !projectName || !role) {
      console.error('Usage: node cli.js add <username> <project_name> <role>');
      process.exit(1);
    }

    try {
      const [user] = await User.findOrCreate({ where: { username } });
      const [project] = await Project.findOrCreate({ where: { name: projectName } });

      const existing = await UserProject.findOne({
        where: {
          UserId: user.id,
          ProjectId: project.id
        }
      });

      if (existing) {
        existing.role = role;
        await existing.save();
      } else {
        await UserProject.create({
          UserId: user.id,
          ProjectId: project.id,
          role: role
        });
      }

      console.log(`Success: ${username} added to ${projectName} as ${role}`);
    } catch (err) {
      console.error('Error adding user to project:', err);
      process.exit(1);
    }
  } else if (command === 'list') {
    const username = args[1];

    if (!username) {
      console.error('Usage: node cli.js list <username>');
      process.exit(1);
    }

    try {
      const user = await User.findOne({
        where: { username },
        include: {
          model: Project,
          through: {
            attributes: ['role']
          }
        }
      });

      if (!user || !user.Projects) {
        console.log(JSON.stringify([]));
        return;
      }

      const result = user.Projects.map(project => ({
        name: project.name,
        role: project.UserProject.role
      }));

      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Error listing projects:', err);
      process.exit(1);
    }
  } else {
    console.error('Unknown command. Use "add" or "list".');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
