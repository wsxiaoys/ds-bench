const { initDB, runFindOrCreate, User, AuditLog } = require('./index.js');
User.beforeCreate((user, options) => {
  console.log("Transaction present in beforeCreate?", !!options.transaction);
});
async function test() {
  await initDB();
  await runFindOrCreate('error_user');
}
test();
