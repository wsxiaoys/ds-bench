const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite in-memory database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

// Define User model
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
  },
});

// Define AuditLog model
const AuditLog = sequelize.define('AuditLog', {
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// beforeCreate hook: creates an AuditLog entry participating in the same transaction
User.addHook('beforeCreate', async (user, options) => {
  const auditLogOptions = {};
  if (options.transaction) {
    auditLogOptions.transaction = options.transaction;
  }
  await AuditLog.create(
    { action: 'Creating user', username: user.username },
    auditLogOptions
  );
});

// afterCreate hook: simulates a failure for 'error_user'
User.addHook('afterCreate', async (user) => {
  if (user.username === 'error_user') {
    throw new Error('Simulated failure');
  }
});

// Initialize the database
async function initDB() {
  await sequelize.sync({ force: true });
}

// Run findOrCreate within a managed transaction so that
// if the afterCreate hook throws, both the User and AuditLog
// creations are rolled back together.
async function runFindOrCreate(username) {
  try {
    const result = await sequelize.transaction(async (t) => {
      const [user] = await User.findOrCreate({
        where: { username },
        defaults: { status: 'active' },
        transaction: t,
      });
      return user;
    });
    return result;
  } catch (err) {
    return err;
  }
}

module.exports = { initDB, runFindOrCreate, User, AuditLog };