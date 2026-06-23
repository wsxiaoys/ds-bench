const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
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

async function main() {
  await sequelize.sync();

  const command = process.argv[2];

  if (command === 'add') {
    const username = process.argv[3];
    const projectName = process.argv[4];
    const role = process.argv[5];

    let [user] = await User.findOrCreate({ where: { username } });
    let [project] = await Project.findOrCreate({ where: { name: projectName } });

    await user.addProject(project, { through: { role } });

    console.log(`Success: ${username} added to ${projectName} as ${role}`);
  } else if (command === 'list') {
    const username = process.argv[3];
    const user = await User.findOne({
      where: { username },
      include: Project
    });

    if (!user) {
      console.log(JSON.stringify([]));
      return;
    }

    const result = user.Projects.map(p => ({
      name: p.name,
      role: p.UserProject.role
    }));

    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
