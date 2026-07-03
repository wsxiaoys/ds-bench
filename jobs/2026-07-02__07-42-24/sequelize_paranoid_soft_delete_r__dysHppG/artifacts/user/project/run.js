const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false // Disable logging to keep stdout clean
});

// Define User model
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  paranoid: true
});

async function main() {
  // Sync the database tables before executing commands
  await sequelize.sync();

  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.error('Please provide a command (create, delete, restore, list, list-all)');
    process.exit(1);
  }

  switch (command) {
    case 'create': {
      const username = args[1];
      if (!username) {
        console.error('Usage: create <username>');
        process.exit(1);
      }
      const user = await User.create({ username });
      console.log(`Created user ${user.username} with ID ${user.id}`);
      break;
    }
    case 'delete': {
      const id = args[1];
      if (!id) {
        console.error('Usage: delete <id>');
        process.exit(1);
      }
      await User.destroy({ where: { id } });
      console.log(`Soft deleted user ${id}`);
      break;
    }
    case 'restore': {
      const id = args[1];
      if (!id) {
        console.error('Usage: restore <id>');
        process.exit(1);
      }
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
    default: {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }
  }

  // Close the connection
  await sequelize.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
