'use strict';

const { Sequelize, DataTypes, Transaction } = require('sequelize');

/**
 * Create a Sequelize instance backed by a file-based SQLite database.
 */
function createSequelize(storagePath) {
  return new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: false,
    // Only one sqlite connection is ever needed; this also keeps behaviour
    // predictable with respect to file-level locking across separate
    // invocations of the CLI operating on the same database file.
    pool: { max: 1, min: 0, idle: 10000 },
  });
}

function defineModels(sequelize) {
  const Order = sequelize.define(
    'Order',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
    },
    {
      tableName: 'Orders',
      timestamps: false,
    }
  );

  const OrderStatusHistory = sequelize.define(
    'OrderStatusHistory',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      fromStatus: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      toStatus: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'OrderStatusHistories',
      timestamps: false,
    }
  );

  Order.hasMany(OrderStatusHistory, { foreignKey: 'orderId', as: 'history' });
  OrderStatusHistory.belongsTo(Order, { foreignKey: 'orderId' });

  return { Order, OrderStatusHistory };
}

/**
 * Ensure the schema required by this application exists on the given
 * database file. Safe to call every time the CLI runs; uses
 * `CREATE TABLE IF NOT EXISTS` so it is idempotent and does not clobber
 * existing data.
 */
async function ensureSchema(sequelize) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "Orders" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "status" TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "OrderStatusHistories" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "orderId" INTEGER NOT NULL,
      "fromStatus" TEXT NOT NULL,
      "toStatus" TEXT NOT NULL,
      "at" DATETIME NOT NULL,
      FOREIGN KEY ("orderId") REFERENCES "Orders" ("id")
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_order_status_histories_order_id"
    ON "OrderStatusHistories" ("orderId");
  `);
}

/**
 * Give sqlite's own busy-handler a chance to wait for locks held by other
 * processes/connections instead of failing immediately with SQLITE_BUSY.
 * This is a defense-in-depth measure; the primary safety mechanism is the
 * IMMEDIATE transaction used for every mutating operation, combined with
 * application-level retries.
 */
async function configureConnection(sequelize) {
  await sequelize.query('PRAGMA busy_timeout = 30000;');
}

module.exports = {
  createSequelize,
  defineModels,
  ensureSchema,
  configureConnection,
  Transaction,
};
