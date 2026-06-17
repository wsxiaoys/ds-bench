const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:', { logging: false });
const User = sequelize.define('User', { username: DataTypes.STRING });
const AuditLog = sequelize.define('AuditLog', { action: DataTypes.STRING, username: DataTypes.STRING });
User.beforeCreate(async (user, options) => {
  await AuditLog.create({ action: 'Creating user', username: user.username }, { transaction: options.transaction });
  if (user.username === 'error_user') {
    throw new Error('Simulated failure');
  }
});
async function test() {
  await sequelize.sync();
  try {
    await User.findOrCreate({ where: { username: 'error_user' } });
  } catch(e) {
    console.log("Caught:", e.message);
  }
  const logs = await AuditLog.findAll();
  console.log("Logs count:", logs.length);
}
test();
