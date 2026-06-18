const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:', { logging: console.log });
const User = sequelize.define('User', { username: DataTypes.STRING });
User.afterCreate(() => { throw new Error('Simulated failure'); });
async function test() {
  await sequelize.sync();
  try {
    await User.findOrCreate({ where: { username: 'error_user' } });
  } catch(e) {
    console.log("Caught:", e.message);
  }
  const users = await User.findAll();
  console.log("Users count:", users.length);
}
test();
