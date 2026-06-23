const { initDB, runFindOrCreate, User, AuditLog } = require('./index.js');
async function test() {
  await initDB();
  const err = await runFindOrCreate('error_user');
  console.log("Error returned:", err.message);
  const logs = await AuditLog.findAll();
  console.log("Logs count:", logs.length);
}
test();
