const { initDB, runFindOrCreate, User, AuditLog } = require('./index.js');

async function test() {
  await initDB();
  console.log("Testing normal_user...");
  const user1 = await runFindOrCreate('normal_user');
  console.log("Created normal_user:", user1.username);
  
  const logs1 = await AuditLog.findAll();
  console.log("Audit logs count:", logs1.length);
  
  console.log("Testing error_user...");
  const err = await runFindOrCreate('error_user');
  console.log("Error returned:", err.message);
  
  const logs2 = await AuditLog.findAll();
  console.log("Audit logs count after error:", logs2.length);
}

test().catch(console.error);
