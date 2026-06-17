const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite",
  logging: false,
});

const User = sequelize.define(
  "User",
  {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    paranoid: true,
  }
);

const actionHandlers = {
  async create([username]) {
    if (!username) {
      throw new Error("Username is required for create");
    }
    const user = await User.create({ username });
    console.log(`Created user ${user.username} with ID ${user.id}`);
  },
  async delete([id]) {
    if (!id) {
      throw new Error("User ID is required for delete");
    }
    await User.destroy({ where: { id } });
    console.log(`Soft deleted user ${id}`);
  },
  async restore([id]) {
    if (!id) {
      throw new Error("User ID is required for restore");
    }
    await User.restore({ where: { id } });
    console.log(`Restored user ${id}`);
  },
  async list() {
    const users = await User.findAll({ order: [["id", "ASC"]] });
    console.log(JSON.stringify(users.map((user) => user.toJSON())));
  },
  async "list-all"() {
    const users = await User.findAll({
      order: [["id", "ASC"]],
      paranoid: false,
    });
    console.log(JSON.stringify(users.map((user) => user.toJSON())));
  },
};

const run = async () => {
  const [action, ...args] = process.argv.slice(2);

  if (!action || !actionHandlers[action]) {
    throw new Error(
      "Usage: node run.js <create|delete|restore|list|list-all> [args]"
    );
  }

  await sequelize.sync();
  await actionHandlers[action](args);
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
