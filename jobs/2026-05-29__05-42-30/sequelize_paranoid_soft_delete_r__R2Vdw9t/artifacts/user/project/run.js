const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// Define the User model with paranoid option
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  paranoid: true,
});

// Parse CLI arguments
const action = process.argv[2];
const arg = process.argv[3];

async function main() {
  // Sync the database tables
  await sequelize.sync();

  switch (action) {
    case 'create': {
      const user = await User.create({ username: arg });
      console.log(`Created user ${user.username} with ID ${user.id}`);
      break;
    }
    case 'delete': {
      await User.destroy({ where: { id: arg } });
      console.log(`Soft deleted user ${arg}`);
      break;
    }
    case 'restore': {
      await User.restore({ where: { id: arg } });
      console.log(`Restored user ${arg}`);
      break;
    }
    case 'list': {
      const users = await User.findAll();
      console.log(JSON.stringify(users.map(u => ({ id: u.id, username: u.username, deletedAt: u.deletedAt }))));
      break;
    }
    case 'list-all': {
      const users = await User.findAll({ paranoid: false });
      console.log(JSON.stringify(users.map(u => ({ id: u.id, username: u.username, deletedAt: u.deletedAt }))));
      break;
    }
    default:
      console.log('Unknown action. Use: create, delete, restore, list, list-all');
  }

  await sequelize.close();
}

main();