const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

const TRANSITIONS = {
  pending: ['cancelled', 'paid'],
  paid: ['cancelled', 'shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: []
};

function initDb(dbPath) {
  // Ensure parent directory exists
  const resolvedPath = path.resolve(dbPath);
  const dbDir = path.dirname(resolvedPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: resolvedPath,
    logging: false,
    dialectOptions: {
      timeout: 10000 // 10s busy timeout for SQLite concurrency
    }
  });

  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'paid', 'shipped', 'delivered', 'cancelled']]
      }
    }
  }, {
    timestamps: true
  });

  const OrderStatusHistory = sequelize.define('OrderStatusHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    fromStatus: {
      type: DataTypes.STRING,
      allowNull: false
    },
    toStatus: {
      type: DataTypes.STRING,
      allowNull: false
    },
    at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: false,
    tableName: 'OrderStatusHistories'
  });

  // Associations
  Order.hasMany(OrderStatusHistory, { foreignKey: 'orderId', as: 'history' });
  OrderStatusHistory.belongsTo(Order, { foreignKey: 'orderId' });

  // Model-level transition logic
  Order.prototype.transitionTo = async function(toStatus, transaction) {
    const fromStatus = this.status;
    const allowed = TRANSITIONS[fromStatus];
    if (!allowed || !allowed.includes(toStatus)) {
      const err = new Error('ILLEGAL_TRANSITION');
      err.name = 'IllegalTransitionError';
      err.from = fromStatus;
      err.to = toStatus;
      throw err;
    }

    this.status = toStatus;
    await this.save({ transaction });

    await OrderStatusHistory.create({
      orderId: this.id,
      fromStatus,
      toStatus,
      at: new Date()
    }, { transaction });
  };

  return { sequelize, Order, OrderStatusHistory };
}

module.exports = {
  TRANSITIONS,
  initDb
};
