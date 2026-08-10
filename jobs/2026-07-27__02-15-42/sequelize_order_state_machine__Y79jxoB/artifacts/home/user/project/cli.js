#!/usr/bin/env node
const { initDb, TRANSITIONS } = require('./db');
const { Transaction } = require('sequelize');

function parseArgs() {
  const args = process.argv.slice(2);
  const subcommand = args[0];

  const options = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1];
      if (val !== undefined && !val.startsWith('--')) {
        options[key] = val;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return { subcommand, options };
}

async function main() {
  const { subcommand, options } = parseArgs();

  if (!subcommand) {
    console.error('Error: Subcommand is required.');
    process.exit(1);
  }

  const dbPath = options.db;
  if (!dbPath) {
    console.error('Error: --db <path> is required.');
    process.exit(1);
  }

  // Initialize DB and ensure schema exists
  const { sequelize, Order, OrderStatusHistory } = initDb(dbPath);
  try {
    await sequelize.sync();
  } catch (error) {
    console.error('Error ensuring schema exists:', error);
    process.exit(1);
  }

  if (subcommand === 'init') {
    console.log(JSON.stringify({ ok: true }));
    await sequelize.close();
    process.exit(0);
  }

  if (subcommand === 'create') {
    try {
      const order = await Order.create({ status: 'pending' });
      console.log(JSON.stringify({ id: order.id, status: 'pending' }));
      await sequelize.close();
      process.exit(0);
    } catch (error) {
      console.error('Error creating order:', error);
      await sequelize.close();
      process.exit(1);
    }
  }

  if (subcommand === 'transition') {
    const orderIdStr = options.id;
    const toStatus = options.to;

    if (!orderIdStr) {
      console.error('Error: --id <number> is required.');
      await sequelize.close();
      process.exit(1);
    }
    if (!toStatus) {
      console.error('Error: --to <status> is required.');
      await sequelize.close();
      process.exit(1);
    }

    const orderId = parseInt(orderIdStr, 10);
    if (isNaN(orderId)) {
      console.error('Error: --id must be a valid number.');
      await sequelize.close();
      process.exit(1);
    }

    try {
      let result;
      await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (t) => {
        const order = await Order.findByPk(orderId, { transaction: t });
        if (!order) {
          const err = new Error('NOT_FOUND');
          err.name = 'NotFoundError';
          throw err;
        }

        const from = order.status;
        await order.transitionTo(toStatus, t);

        result = {
          ok: true,
          id: order.id,
          from,
          to: toStatus
        };
      });

      console.log(JSON.stringify(result));
      await sequelize.close();
      process.exit(0);
    } catch (error) {
      if (error.name === 'NotFoundError') {
        console.log(JSON.stringify({
          ok: false,
          error: 'NOT_FOUND',
          id: orderId
        }));
        await sequelize.close();
        process.exit(4);
      } else if (error.name === 'IllegalTransitionError') {
        console.log(JSON.stringify({
          ok: false,
          error: 'ILLEGAL_TRANSITION',
          id: orderId,
          from: error.from,
          to: error.to
        }));
        await sequelize.close();
        process.exit(3);
      } else {
        console.error('Error executing transition:', error);
        await sequelize.close();
        process.exit(1);
      }
    }
  }

  if (subcommand === 'show') {
    const orderIdStr = options.id;
    if (!orderIdStr) {
      console.error('Error: --id <number> is required.');
      await sequelize.close();
      process.exit(1);
    }

    const orderId = parseInt(orderIdStr, 10);
    if (isNaN(orderId)) {
      console.error('Error: --id must be a valid number.');
      await sequelize.close();
      process.exit(1);
    }

    try {
      const order = await Order.findByPk(orderId, {
        include: [{
          model: OrderStatusHistory,
          as: 'history'
        }]
      });

      if (!order) {
        console.log(JSON.stringify({
          ok: false,
          error: 'NOT_FOUND',
          id: orderId
        }));
        await sequelize.close();
        process.exit(4);
      }

      const history = (order.history || [])
        .sort((a, b) => a.id - b.id)
        .map(h => ({
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          at: h.at instanceof Date ? h.at.toISOString() : new Date(h.at).toISOString()
        }));

      console.log(JSON.stringify({
        id: order.id,
        status: order.status,
        history
      }));

      await sequelize.close();
      process.exit(0);
    } catch (error) {
      console.error('Error showing order:', error);
      await sequelize.close();
      process.exit(1);
    }
  }

  if (subcommand === 'transitions') {
    // Print transition table
    console.log(JSON.stringify(TRANSITIONS));
    await sequelize.close();
    process.exit(0);
  }

  console.error(`Error: Unknown subcommand "${subcommand}"`);
  await sequelize.close();
  process.exit(1);
}

main().catch(async (error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});
