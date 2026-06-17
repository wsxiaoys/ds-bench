'use strict';

const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
  },
});

const AuditLog = sequelize.define('AuditLog', {
  action: {
    type: DataTypes.STRING,
  },
  username: {
    type: DataTypes.STRING,
  },
});

// beforeCreate hook: must participate in the same transaction as User creation.
// options.transaction is the explicit transaction we pass from runFindOrCreate.
User.addHook('beforeCreate', async (user, options) => {
  await AuditLog.create(
    { action: 'Creating user', username: user.username },
    { transaction: options.transaction }
  );
});

// afterCreate hook: simulate a hard failure for 'error_user'.
User.addHook('afterCreate', async (user, _options) => {
  if (user.username === 'error_user') {
    throw new Error('Simulated failure');
  }
});

async function initDB() {
  await sequelize.sync({ force: true });
}

/**
 * Runs User.findOrCreate inside an *explicit* transaction that we own.
 * Because we supply the transaction, Sequelize's findOrCreate sets
 * `internalTransaction = false` and never commits/rolls back on its own.
 * We therefore control the outcome: commit on success, rollback on error.
 *
 * The beforeCreate hook receives options.transaction (our explicit transaction)
 * and forwards it to AuditLog.create, so both writes are atomic.
 */
async function runFindOrCreate(username) {
  const t = await sequelize.transaction();
  try {
    const [user] = await User.findOrCreate({
      where: { username },
      defaults: { status: 'active' },
      transaction: t,
    });
    await t.commit();
    return user;
  } catch (err) {
    await t.rollback();
    return err;
  }
}

module.exports = { initDB, runFindOrCreate, User, AuditLog };

// Quick local smoke-test: `node index.js`
if (require.main === module) {
  (async () => {
    await initDB();
    console.log('DB initialised.');

    const normalResult = await runFindOrCreate('normal_user');
    console.log(
      'normal_user result:',
      normalResult instanceof Error ? normalResult.message : normalResult.toJSON()
    );

    const auditAfterNormal = await AuditLog.findAll({ where: { username: 'normal_user' } });
    console.log('AuditLog entries for normal_user:', auditAfterNormal.length); // expect 1

    const errorResult = await runFindOrCreate('error_user');
    console.log(
      'error_user result:',
      errorResult instanceof Error ? errorResult.message : errorResult.toJSON()
    );

    const auditAfterError = await AuditLog.findAll({ where: { username: 'error_user' } });
    console.log('AuditLog entries for error_user:', auditAfterError.length); // expect 0 (rolled back)
  })();
}
