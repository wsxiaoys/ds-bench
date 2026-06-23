const { Sequelize, DataTypes } = require('sequelize');
const cls = require('cls-hooked');
const namespace = cls.createNamespace('my-namespace');
Sequelize.useCLS(namespace);
const sequelize = new Sequelize('sqlite::memory:', { logging: false });
const User = sequelize.define('User', { username: DataTypes.STRING });
const AuditLog = sequelize.define('AuditLog', { action: DataTypes.STRING, username: DataTypes.STRING });
User.beforeCreate(async (user, options) => {
  await AuditLog.create({ action: 'Creating user', username: user.username }, { transaction: options.transaction });
});
User.afterCreate(async (user, options) => {
  if (user.username === 'error_user') {
    throw new Error('Simulated failure');
  }
});
async function runFindOrCreate(username) {
  try {
    const [user, created] = await User.findOrCreate({
      where: { username },
      defaults: { status: 'active' }
    });
    return user;
  } catch (error) {
    return error;
  }
}
async function test() {
  await sequelize.sync();
  const err = await runFindOrCreate('error_user');
  console.log("Error returned:", err.message);
  const logs = await AuditLog.findAll();
  console.log("Logs count:", logs.length);
}
test();
