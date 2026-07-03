#!/usr/bin/env node

const { sequelize, User, Project } = require('./models');

async function addUserToProject(username, projectName, role) {
  // Find or create the user
  const [user] = await User.findOrCreate({
    where: { username },
    defaults: { username },
  });

  // Find or create the project
  const [project] = await Project.findOrCreate({
    where: { name: projectName },
    defaults: { name: projectName },
  });

  // Associate the user with the project and set the role via the junction table
  await sequelize.models.UserProject.upsert({
    UserId: user.id,
    ProjectId: project.id,
    role,
  });

  console.log(`Success: ${username} added to ${projectName} as ${role}`);
}

async function listUserProjects(username) {
  const user = await User.findOne({
    where: { username },
    include: {
      model: Project,
      through: { attributes: ['role'] },
    },
  });

  if (!user) {
    console.log('[]');
    return;
  }

  const result = user.Projects.map((project) => {
    const item = project.get({ plain: true });
    return {
      name: item.name,
      role: item.UserProject.role,
    };
  });

  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  try {
    await sequelize.sync();

    if (command === 'add') {
      const [username, projectName, role] = args;
      if (!username || !projectName || !role) {
        console.error('Usage: add <username> <project_name> <role>');
        process.exitCode = 1;
        return;
      }
      await addUserToProject(username, projectName, role);
    } else if (command === 'list') {
      const [username] = args;
      if (!username) {
        console.error('Usage: list <username>');
        process.exitCode = 1;
        return;
      }
      await listUserProjects(username);
    } else {
      console.error('Unknown command. Available commands: add, list');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
