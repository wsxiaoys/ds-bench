const { initDB, runFindOrCreate, User, AuditLog } = require('./index.js');
async function test() {
  await initDB();
  await runFindOrCreate('normal_user');
  await runFindOrCreate('error_user');
  const logs = await AuditLog.findAll();
  console.log(logs.map(l => l.toJSON()));
}
test();
