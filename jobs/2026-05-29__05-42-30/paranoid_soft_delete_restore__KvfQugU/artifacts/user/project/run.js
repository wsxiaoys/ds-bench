const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  paranoid: true
});

async function main() {
  await sequelize.sync();

  const action = process.argv[2];
  const arg = process.argv[3];

  if (action === 'create') {
    const user = await User.create({ username: arg });
    console.log(`Created user ${user.username} with ID ${user.id}`);
  } else if (action === 'delete') {
    await User.destroy({ where: { id: arg } });
    console.log(`Soft deleted user ${arg}`);
  } else if (action === 'restore') {
    await User.restore({ where: { id: arg } });
    console.log(`Restored user ${arg}`);
  } else if (action === 'list') {
    const users = await User.findAll();
    console.log(JSON.stringify(users));
  } else if (action === 'list-all') {
    const users = await User.findAll({ paranoid: false });
    console.log(JSON.stringify(users));
  } else {
    console.error('Unknown action');
  }

  await sequelize.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
