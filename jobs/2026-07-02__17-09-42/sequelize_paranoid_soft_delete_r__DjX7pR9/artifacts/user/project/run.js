const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// Define the User model with paranoid: true for soft deletes
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  paranoid: true,
});

// Main async function to handle CLI commands
async function main() {
  // Sync the database (creating tables if they don't exist)
  await sequelize.sync();

  // Parse CLI arguments (skip 'node' and script path)
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'create': {
      const username = args[1];
      const user = await User.create({ username });
      console.log(`Created user ${user.username} with ID ${user.id}`);
      break;
    }
    case 'delete': {
      const id = args[1];
      await User.destroy({ where: { id } });
      console.log(`Soft deleted user ${id}`);
      break;
    }
    case 'restore': {
      const id = args[1];
      await User.restore({ where: { id } });
      console.log(`Restored user ${id}`);
      break;
    }
    case 'list': {
      const users = await User.findAll();
      console.log(JSON.stringify(users));
      break;
    }
    case 'list-all': {
      const users = await User.findAll({ paranoid: false });
      console.log(JSON.stringify(users));
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exitCode = 1;
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});