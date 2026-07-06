const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

const AuditLog = sequelize.define('AuditLog', {
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Hooks
User.beforeCreate(async (user, options) => {
  const transaction = options.transaction || null;
  await AuditLog.create({
    action: 'Creating user',
    username: user.username
  }, { transaction });
});

User.afterCreate(async (user, options) => {
  if (user.username === 'error_user') {
    if (options.transaction) {
      const tx = options.transaction;
      await tx.rollback();
      tx.commit = async () => {};
    }
    throw new Error('Simulated failure');
  }
});

async function initDB() {
  await sequelize.sync({ force: true });
}

async function runFindOrCreate(username) {
  try {
    const [user, created] = await User.findOrCreate({
      where: { username },
      defaults: { status: 'active' }
    });
    return user;
  } catch (error) {
    return error;
  }
}

module.exports = {
  sequelize,
  User,
  AuditLog,
  initDB,
  runFindOrCreate
};
