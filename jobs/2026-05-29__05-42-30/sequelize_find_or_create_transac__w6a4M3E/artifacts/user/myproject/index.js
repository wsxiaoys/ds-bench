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
    allowNull: false,
  },
});

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

User.addHook('beforeCreate', async (user, options) => {
  const transaction = options.transaction;
  await AuditLog.create(
    {
      action: 'Creating user',
      username: user.username,
    },
    transaction ? { transaction } : undefined
  );
});

User.addHook('afterCreate', async (user) => {
  if (user.username === 'error_user') {
    throw new Error('Simulated failure');
  }
});

const initDB = async () => {
  await sequelize.sync({ force: true });
};

const runFindOrCreate = async (username) => {
  try {
    const [user] = await User.findOrCreate({
      where: { username },
      defaults: { status: 'active' },
    });
    return user;
  } catch (error) {
    return error;
  }
};

module.exports = {
  initDB,
  runFindOrCreate,
  User,
  AuditLog,
};
