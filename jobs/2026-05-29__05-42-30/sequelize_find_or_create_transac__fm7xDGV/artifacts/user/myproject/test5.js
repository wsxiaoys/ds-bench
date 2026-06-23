const { initDB, runFindOrCreate, User, AuditLog, sequelize } = require('./index.js');
async function test() {
  await initDB();
  try {
    await sequelize.transaction(async (t) => {
      await User.create({ username: 'error_user' }, { transaction: t });
    });
  } catch(e) {
    console.log("Caught:", e.message);
  }
  const users = await User.findAll();
  console.log("Users:", users.map(u => u.toJSON()));
}
test();
