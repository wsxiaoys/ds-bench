const { initDB, runFindOrCreate, User, AuditLog } = require('./index.js');
User.afterCreate((user, options) => {
  console.log("Transaction in afterCreate?", !!options.transaction);
});
async function test() {
  await initDB();
  await runFindOrCreate('error_user');
}
test();
