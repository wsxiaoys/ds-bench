const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
});

class User extends Model {}
class AuditLog extends Model {}

User.init(
  {
    username: {
      type: DataTypes.STRING,
      unique: true
    },
    status: {
      type: DataTypes.STRING
    }
  },
  {
    sequelize,
    modelName: 'User'
  }
);

AuditLog.init(
  {
    action: {
      type: DataTypes.STRING
    },
    username: {
      type: DataTypes.STRING
    }
  },
  {
    sequelize,
    modelName: 'AuditLog'
  }
);

User.addHook('beforeCreate', async (user, options) => {
  await AuditLog.create(
    {
      action: 'Creating user',
      username: user.username
    },
    { transaction: options.transaction }
  );
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
  const transaction = await sequelize.transaction();
  try {
    const [user, created] = await User.findOrCreate({
      where: { username },
      defaults: { status: 'active' },
      transaction
    });
    await transaction.commit();
    return user;
  } catch (err) {
    await transaction.rollback();
    return err;
  }
}

module.exports = {
  initDB,
  runFindOrCreate,
  User,
  AuditLog,
  sequelize
};
