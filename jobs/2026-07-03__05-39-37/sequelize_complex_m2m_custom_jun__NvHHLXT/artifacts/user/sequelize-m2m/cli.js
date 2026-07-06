const { sequelize, User, Project, UserProject } = require('./db');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.error('Usage: node cli.js <add|list> [args]');
    process.exit(1);
  }

  // Ensure the database schema is synchronized before executing queries
  await sequelize.sync();

  try {
    if (command === 'add') {
      const [username, projectName, role] = args.slice(1);

      if (!username || !projectName || !role) {
        console.error('Usage: node cli.js add <username> <project_name> <role>');
        process.exit(1);
      }

      await addAssociation(username, projectName, role);
    } else if (command === 'list') {
      const [username] = args.slice(1);

      if (!username) {
        console.error('Usage: node cli.js list <username>');
        process.exit(1);
      }

      await listProjects(username);
    } else {
      console.error(`Unknown command: ${command}`);
      console.error('Usage: node cli.js <add|list> [args]');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

/**
 * Create the user (if not exists), the project (if not exists),
 * and associate them with the given role.
 */
async function addAssociation(username, projectName, role) {
  // findOrCreate ensures we don't duplicate existing records
  const [user] = await User.findOrCreate({
    where: { username },
    defaults: { username },
  });

  const [project] = await Project.findOrCreate({
    where: { name: projectName },
    defaults: { name: projectName },
  });

  // Add the project to the user with the given role.
  // `addProject` with the through option will create/update the junction row.
  await user.addProject(project, { through: { role } });

  console.log(`Success: ${username} added to ${projectName} as ${role}`);
}

/**
 * Retrieve all projects for a given user, including the custom `role`
 * attribute from the junction table, and print as a JSON array.
 */
async function listProjects(username) {
  const user = await User.findOne({
    where: { username },
    include: [
      {
        model: Project,
        through: { attributes: ['role'] },
      },
    ],
  });

  if (!user) {
    console.log('[]');
    return;
  }

  const projects = user.Projects.map((project) => ({
    name: project.name,
    role: project.UserProject.role,
  }));

  console.log(JSON.stringify(projects, null, 2));
}

main();