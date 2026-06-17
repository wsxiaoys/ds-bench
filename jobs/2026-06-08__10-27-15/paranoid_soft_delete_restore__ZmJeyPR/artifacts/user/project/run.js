const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
});

class User extends Model {}
User.init({
  username: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'User',
  paranoid: true
});

async function main() {
  await sequelize.sync();

  const [,, action, ...args] = process.argv;

  try {
    switch (action) {
      case 'create': {
        const username = args[0];
        if (!username) {
          console.error('Username is required');
          return;
        }
        const user = await User.create({ username });
        console.log(`Created user ${user.username} with ID ${user.id}`);
        break;
      }
      case 'delete': {
        const id = args[0];
        if (!id) {
          console.error('ID is required');
          return;
        }
        await User.destroy({ where: { id } });
        console.log(`Soft deleted user ${id}`);
        break;
      }
      case 'restore': {
        const id = args[0];
        if (!id) {
          console.error('ID is required');
          return;
        }
        await User.restore({ where: { id } });
        console.log(`Restored user ${id}`);
        break;
      }
      case 'list': {
        const users = await User.findAll();
        console.log(JSON.stringify(users, null, 2));
        break;
      }
      case 'list-all': {
        const users = await User.findAll({ paranoid: false });
        console.log(JSON.stringify(users, null, 2));
        break;
      }
      default:
        // Do nothing or print help
        break;
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

main();
