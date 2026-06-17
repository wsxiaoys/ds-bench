const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    unique: true
  },
  status: {
    type: DataTypes.STRING
  }
});

const AuditLog = sequelize.define('AuditLog', {
  action: {
    type: DataTypes.STRING
  },
  username: {
    type: DataTypes.STRING
  }
});

User.beforeCreate(async (user, options) => {
  await AuditLog.create(
    {
      action: 'Creating user',
      username: user.username
    },
    {
      transaction: options.transaction
    }
  );
});

User.afterCreate(async (user, options) => {
  if (user.username === 'error_user') {
    if (options.transaction && !options.transaction.finished) {
      await options.transaction.rollback();
      options.transaction.commit = async () => {};
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
  initDB,
  runFindOrCreate,
  User,
  AuditLog,
  sequelize
};
