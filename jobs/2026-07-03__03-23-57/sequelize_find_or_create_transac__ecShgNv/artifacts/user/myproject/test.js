const { initDB, runFindOrCreate, User, AuditLog } = require('./index.js');

async function test() {
  console.log('Initializing DB...');
  await initDB();

  console.log('\n--- Testing Normal User Creation (First Call) ---');
  const normalUserResult1 = await runFindOrCreate('normal_user');
  if (normalUserResult1 instanceof Error) {
    console.error('Unexpected error for normal_user:', normalUserResult1.message);
  } else {
    console.log('Successfully created user:', normalUserResult1.username);
  }

  // Check DB status for normal_user
  let normalUsers = await User.findAll({ where: { username: 'normal_user' } });
  let normalAuditLogs = await AuditLog.findAll({ where: { username: 'normal_user' } });
  console.log('Users found in DB:', normalUsers.map(u => u.username));
  console.log('Audit logs found in DB:', normalAuditLogs.map(l => ({ action: l.action, username: l.username })));

  console.log('\n--- Testing Normal User Creation (Second Call) ---');
  const normalUserResult2 = await runFindOrCreate('normal_user');
  if (normalUserResult2 instanceof Error) {
    console.error('Unexpected error for normal_user:', normalUserResult2.message);
  } else {
    console.log('Successfully found user:', normalUserResult2.username);
  }

  // Check DB status for normal_user
  normalUsers = await User.findAll({ where: { username: 'normal_user' } });
  normalAuditLogs = await AuditLog.findAll({ where: { username: 'normal_user' } });
  console.log('Users found in DB:', normalUsers.map(u => u.username));
  console.log('Audit logs found in DB:', normalAuditLogs.map(l => ({ action: l.action, username: l.username })));

  console.log('\n--- Testing Error User Creation ---');
  const errorUserResult = await runFindOrCreate('error_user');
  if (errorUserResult instanceof Error) {
    console.log('Expected error caught:', errorUserResult.message);
  } else {
    console.error('Expected error but succeeded instead:', errorUserResult.username);
  }

  // Check DB status for error_user
  const errorUsers = await User.findAll({ where: { username: 'error_user' } });
  const errorAuditLogs = await AuditLog.findAll({ where: { username: 'error_user' } });
  console.log('Users found in DB:', errorUsers.map(u => u.username));
  console.log('Audit logs found in DB:', errorAuditLogs.map(l => ({ action: l.action, username: l.username })));

  if (errorUsers.length === 0 && errorAuditLogs.length === 0) {
    console.log('\nSUCCESS: Both User and AuditLog entries for error_user were successfully rolled back!');
  } else {
    console.error('\nFAILURE: Rollback did not work as expected!');
  }
}

test().catch(console.error);
