'use strict';

const { Transaction } = require('./db');
const { isLegalTransition } = require('./transitions');

function isBusyError(err) {
  const codes = new Set(['SQLITE_BUSY', 'SQLITE_LOCKED']);
  if (err && err.original && codes.has(err.original.code)) return true;
  if (err && err.parent && codes.has(err.parent.code)) return true;
  if (err && codes.has(err.code)) return true;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function on transient sqlite "busy"/"locked" errors that can
 * surface when multiple separate processes contend for the same database
 * file's write lock. Uses a small randomized backoff.
 */
async function withBusyRetry(fn, { retries = 20, baseDelayMs = 15 } = {}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt >= retries || !isBusyError(err)) {
        throw err;
      }
      await sleep(baseDelayMs + Math.random() * baseDelayMs * attempt);
    }
  }
}

/**
 * Create a new order in the initial `pending` state.
 */
async function createOrder(sequelize, { Order }) {
  const order = await Order.create({ status: 'pending' });
  return { id: order.id, status: order.status };
}

/**
 * Attempt to transition an order to a new status.
 *
 * Runs inside a sqlite IMMEDIATE transaction, which acquires sqlite's
 * reserved write lock at the start of the transaction (rather than lazily
 * on the first write). Combined with the fact that sqlite only ever allows
 * a single writer, this fully serializes concurrent transition attempts
 * against the same order (or any order in the same database file): only
 * one such transaction can be in its critical section (read status ->
 * decide legality -> write status + history) at a time, so the
 * read-then-write is effectively atomic and race-free, even across
 * separate OS processes.
 *
 * Returns a plain result object describing the outcome; never throws for
 * expected business-logic outcomes (not found / illegal transition).
 */
async function transitionOrder(sequelize, { Order, OrderStatusHistory }, id, to) {
  return withBusyRetry(() =>
    sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (t) => {
      const order = await Order.findByPk(id, { transaction: t });

      if (!order) {
        return { ok: false, error: 'NOT_FOUND', id };
      }

      const from = order.status;

      if (!isLegalTransition(from, to)) {
        return { ok: false, error: 'ILLEGAL_TRANSITION', id, from, to };
      }

      order.status = to;
      await order.save({ transaction: t });

      await OrderStatusHistory.create(
        {
          orderId: id,
          fromStatus: from,
          toStatus: to,
          at: new Date(),
        },
        { transaction: t }
      );

      return { ok: true, id, from, to };
    })
  );
}

/**
 * Fetch an order along with its full, chronologically ordered history.
 * Returns null if the order does not exist.
 */
async function getOrderWithHistory(sequelize, { Order, OrderStatusHistory }, id) {
  const order = await Order.findByPk(id);
  if (!order) {
    return null;
  }

  const rows = await OrderStatusHistory.findAll({
    where: { orderId: id },
    order: [
      ['at', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const history = rows.map((row) => ({
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    at: new Date(row.at).toISOString(),
  }));

  return { id: order.id, status: order.status, history };
}

module.exports = {
  createOrder,
  transitionOrder,
  getOrderWithHistory,
  withBusyRetry,
};
