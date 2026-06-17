const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING
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

User.addHook('beforeCreate', async (user, options) => {
  if (options.transaction) {
    await AuditLog.create({
      action: 'Creating user',
      username: user.username
    }, { transaction: options.transaction });
  }
});

User.addHook('afterCreate', async (user, options) => {
  if (user.username === 'error_user') {
    throw new Error('Simulated failure');
  }
});

async function initDB() {
  await sequelize.sync({ force: true });
}

async function runFindOrCreate(username) {
  try {
    return await sequelize.transaction(async (t) => {
      const [user, created] = await User.findOrCreate({
        where: { username },
        defaults: { status: 'active' },
        transaction: t
      });
      return user;
    });
  } catch (error) {
    return error;
  }
}

module.exports = {
  initDB,
  runFindOrCreate,
  User,
  AuditLog
};
