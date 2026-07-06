const { Sequelize, DataTypes } = require('sequelize');

// Initialize a Sequelize instance backed by SQLite (in-memory storage).
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

// Define the User model.
const User = sequelize.define(
  'User',
  {
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    hooks: {
      // beforeCreate: create an AuditLog entry that participates in the same
      // transaction Sequelize uses for the surrounding operation.
      //
      // When findOrCreate is used, Sequelize creates an internal transaction
      // (or a savepoint within an outer managed transaction).  We must pass
      // `options.transaction` to AuditLog.create so the audit row shares that
      // transaction.  If we omit it, the row is committed immediately and will
      // survive a later rollback of the main operation.
      beforeCreate: async (user, options) => {
        await AuditLog.create(
          {
            action: 'Creating user',
            username: user.username,
          },
          { transaction: options.transaction }
        );
      },
      // afterCreate: simulate a failure for a specific username.  When this
      // throws, the surrounding transaction must roll back, including the
      // AuditLog row written in beforeCreate.
      afterCreate: async (user, options) => {
        if (user.username === 'error_user') {
          throw new Error('Simulated failure');
        }
      },
    },
  }
);

// Define the AuditLog model.
const AuditLog = sequelize.define('AuditLog', {
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

/**
 * Sync the database, recreating all tables from scratch.
 */
async function initDB() {
  await sequelize.sync({ force: true });
}

/**
 * Run findOrCreate for the given username.
 *
 * We wrap the call in a managed transaction (`sequelize.transaction`).
 * Sequelize's `findOrCreate` creates its own internal transaction when no
 * transaction is supplied, but in Sequelize v6 that internal transaction is
 * *committed* in a `finally` block even when an error is thrown — so a
 * rollback would never happen.
 *
 * By supplying our own managed transaction:
 *   - `findOrCreate` sees `options.transaction` is set, so it does NOT create
 *     an internal transaction (it creates a savepoint instead) and its
 *     `finally` block does NOT commit.
 *   - If the `afterCreate` hook throws, the error propagates out of
 *     `findOrCreate` and out of the managed-transaction callback, causing
 *     `sequelize.transaction` to REDACTEDmatically ROLL BACK — which removes
 *     both the User row and the AuditLog row written by `beforeCreate`.
 *   - If everything succeeds, the managed transaction commits normally.
 *
 * The `beforeCreate` hook passes `options.transaction` to `AuditLog.create`
 * so the audit row participates in the same transaction and is rolled back
 * together with everything else.
 *
 * @param {string} username
 * @returns {Promise<{ user: object, created: boolean } | { error: string }>}
 */
async function runFindOrCreate(username) {
  try {
    const result = await sequelize.transaction(async (t) => {
      const [user, created] = await User.findOrCreate({
        where: { username },
        defaults: { status: 'active' },
        transaction: t,
      });
      return { user, created };
    });
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = {
  initDB,
  runFindOrCreate,
  User,
  AuditLog,
};