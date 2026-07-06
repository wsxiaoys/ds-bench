const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

class User extends Model {}

User.init(
  {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'User',
    paranoid: true,
  }
);

async function main() {
  await sequelize.sync();

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'create': {
      const username = args[1];
      const user = await User.create({ username });
      console.log(`Created user ${username} with ID ${user.id}`);
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
      process.exit(1);
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
