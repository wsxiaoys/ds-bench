const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "database.sqlite",
  logging: false,
});

const User = sequelize.define(
  "User",
  {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    timestamps: false,
  }
);

const Project = sequelize.define(
  "Project",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    timestamps: false,
  }
);

const UserProject = sequelize.define(
  "UserProject",
  {
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: false,
  }
);

User.belongsToMany(Project, { through: UserProject });
Project.belongsToMany(User, { through: UserProject });

const [command, ...args] = process.argv.slice(2);

async function addUserToProject(username, projectName, role) {
  await sequelize.sync();

  const [user] = await User.findOrCreate({
    where: { username },
  });

  const [project] = await Project.findOrCreate({
    where: { name: projectName },
  });

  await user.addProject(project, { through: { role } });

  console.log(`Success: ${username} added to ${projectName} as ${role}`);
}

async function listUserProjects(username) {
  await sequelize.sync();

  const user = await User.findOne({
    where: { username },
    include: {
      model: Project,
      through: {
        attributes: ["role"],
      },
    },
  });

  if (!user) {
    console.log("[]");
    return;
  }

  const projects = user.Projects.map((project) => ({
    name: project.name,
    role: project.UserProject.role,
  }));

  console.log(JSON.stringify(projects, null, 2));
}

async function run() {
  if (command === "add") {
    const [username, projectName, role] = args;
    if (!username || !projectName || !role) {
      console.error("Usage: node cli.js add <username> <project_name> <role>");
      process.exit(1);
    }
    await addUserToProject(username, projectName, role);
    return;
  }

  if (command === "list") {
    const [username] = args;
    if (!username) {
      console.error("Usage: node cli.js list <username>");
      process.exit(1);
    }
    await listUserProjects(username);
    return;
  }

  console.error("Usage: node cli.js <command> [args...]");
  process.exit(1);
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
