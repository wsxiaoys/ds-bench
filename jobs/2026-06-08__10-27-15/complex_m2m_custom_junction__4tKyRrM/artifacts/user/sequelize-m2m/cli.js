'use strict';

const { sequelize, User, Project, UserProject } = require('./models');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Sync all models with the database (create tables if they don't exist)
  await sequelize.sync();

  if (command === 'add') {
    const [, username, projectName, role] = args;

    if (!username || !projectName || !role) {
      console.error('Usage: node cli.js add <username> <project_name> <role>');
      process.exit(1);
    }

    // Find or create the user
    const [user] = await User.findOrCreate({
      where: { username },
    });

    // Find or create the project
    const [project] = await Project.findOrCreate({
      where: { name: projectName },
    });

    // Create or update the association with the given role
    await UserProject.upsert({
      UserId: user.id,
      ProjectId: project.id,
      role,
    });

    console.log(`Success: ${username} added to ${projectName} as ${role}`);

  } else if (command === 'list') {
    const [, username] = args;

    if (!username) {
      console.error('Usage: node cli.js list <username>');
      process.exit(1);
    }

    // Find the user
    const user = await User.findOne({ where: { username } });

    if (!user) {
      console.log(JSON.stringify([]));
      process.exit(0);
    }

    // Get all projects for this user, including the role from the junction table
    const projects = await user.getProjects({
      joinTableAttributes: ['role'],
    });

    // Format the output as required
    const result = projects.map((project) => ({
      name: project.name,
      role: project.UserProject.role,
    }));

    console.log(JSON.stringify(result, null, 2));

  } else {
    console.error('Unknown command. Use "add" or "list".');
    process.exit(1);
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
