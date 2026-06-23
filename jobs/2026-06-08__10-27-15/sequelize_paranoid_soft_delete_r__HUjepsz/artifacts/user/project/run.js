const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  paranoid: true,
});

async function main() {
  await sequelize.sync();

  const [action, arg] = process.argv.slice(2);

  switch (action) {
    case 'create': {
      const user = await User.create({ username: arg });
      console.log(`Created user ${user.username} with ID ${user.id}`);
      break;
    }

    case 'delete': {
      const id = parseInt(arg, 10);
      await User.destroy({ where: { id } });
      console.log(`Soft deleted user ${id}`);
      break;
    }

    case 'restore': {
      const id = parseInt(arg, 10);
      await User.restore({ where: { id } });
      console.log(`Restored user ${id}`);
      break;
    }

    case 'list': {
      const users = await User.findAll();
      const output = users.map(u => ({ id: u.id, username: u.username, deletedAt: u.deletedAt }));
      console.log(JSON.stringify(output));
      break;
    }

    case 'list-all': {
      const users = await User.findAll({ paranoid: false });
      const output = users.map(u => ({ id: u.id, username: u.username, deletedAt: u.deletedAt }));
      console.log(JSON.stringify(output));
      break;
    }

    default:
      console.error(`Unknown action: ${action}`);
      console.error('Usage: node run.js <create|delete|restore|list|list-all> [args]');
      process.exit(1);
  }

  await sequelize.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
