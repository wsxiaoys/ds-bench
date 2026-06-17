const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:', { logging: console.log });
const User = sequelize.define('User', { username: DataTypes.STRING });
User.afterCreate(() => { throw new Error('Simulated failure'); });
async function test() {
  await sequelize.sync();
  try {
    await sequelize.transaction(async (t) => {
      await User.create({ username: 'error_user' }, { transaction: t });
    });
  } catch(e) {
    console.log("Caught:", e.message);
  }
  const users = await User.findAll();
  console.log("Users count:", users.length);
}
test();
