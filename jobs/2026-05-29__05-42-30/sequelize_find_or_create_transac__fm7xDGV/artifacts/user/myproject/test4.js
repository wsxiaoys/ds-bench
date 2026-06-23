const { initDB, runFindOrCreate, User, AuditLog } = require('./index.js');
async function test() {
  await initDB();
  await runFindOrCreate('error_user');
  const users = await User.findAll();
  console.log(users.map(u => u.toJSON()));
}
test();
