const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
});

const Project = sequelize.define('Project', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
});

const UserProject = sequelize.define('UserProject', {
  role: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

User.belongsToMany(Project, { through: UserProject });
Project.belongsToMany(User, { through: UserProject });

async function run() {
  await sequelize.sync();

  const [command, ...args] = process.argv.slice(2);

  if (command === 'add') {
    const [username, projectName, role] = args;
    if (!username || !projectName || !role) {
      console.error('Usage: node cli.js add <username> <project_name> <role>');
      process.exit(1);
    }

    try {
      const [user] = await User.findOrCreate({ where: { username } });
      const [project] = await Project.findOrCreate({ where: { name: projectName } });
      
      await user.addProject(project, { through: { role } });
      
      console.log(`Success: ${username} added to ${projectName} as ${role}`);
    } catch (error) {
      console.error('Error adding user to project:', error.message);
      process.exit(1);
    }
  } else if (command === 'list') {
    const [username] = args;
    if (!username) {
      console.error('Usage: node cli.js list <username>');
      process.exit(1);
    }

    try {
      const user = await User.findOne({
        where: { username },
        include: {
          model: Project,
          through: { attributes: ['role'] }
        }
      });

      if (!user) {
        console.log('[]');
        return;
      }

      const projects = user.Projects.map(project => ({
        name: project.name,
        role: project.UserProject.role
      }));

      console.log(JSON.stringify(projects, null, 2));
    } catch (error) {
      console.error('Error listing projects:', error.message);
      process.exit(1);
    }
  } else {
    console.error('Unknown command. Available commands: add, list');
    process.exit(1);
  }
}

run();
