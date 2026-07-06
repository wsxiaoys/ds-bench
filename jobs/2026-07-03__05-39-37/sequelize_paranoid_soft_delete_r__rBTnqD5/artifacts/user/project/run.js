const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// Define the User model with paranoid enabled for soft deletes
const User = sequelize.define(
  'User',
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

async function main() {
  const [command, ...args] = process.argv.slice(2);

  // Sync tables before executing commands
  await sequelize.sync();

  switch (command) {
    case 'create': {
      const username = args[0];
      const user = await User.create({ username });
      console.log(`Created user ${user.username} with ID ${user.id}`);
      break;
    }
    case 'delete': {
      const id = args[0];
      await User.destroy({ where: { id } });
      console.log(`Soft deleted user ${id}`);
      break;
    }
    case 'restore': {
      const id = args[0];
      await User.restore({ where: { id } });
      console.log(`Restored user ${id}`);
      break;
    }
    case 'list': {
      const users = await User.findAll();
      const output = users.map((u) => ({
        id: u.id,
        username: u.username,
        deletedAt: u.deletedAt,
      }));
      console.log(JSON.stringify(output));
      break;
    }
    case 'list-all': {
      const users = await User.findAll({ paranoid: false });
      const output = users.map((u) => ({
        id: u.id,
        username: u.username,
        deletedAt: u.deletedAt,
      }));
      console.log(JSON.stringify(output));
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});