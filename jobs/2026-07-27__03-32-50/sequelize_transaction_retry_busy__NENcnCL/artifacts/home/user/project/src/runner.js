"use strict";

const { Sequelize, DataTypes, Transaction } = require("sequelize");

/**
 * How long (in ms) a single SQLite connection will let the native driver
 * internally wait/poll before surfacing a SQLITE_BUSY error. This is a
 * connection-level safety net so that momentary lock contention does not
 * fail instantly - it gives the currently-active writer a chance to finish.
 * Application-level retries (see withRetry) handle contention that outlives
 * this window.
 */
const DEFAULT_BUSY_TIMEOUT_MS = 2000;

const COUNTER_ROW_ID = 1;

/**
 * SQLite (via node-sqlite3) surfaces lock contention as SQLITE_BUSY (the
 * database is locked by another connection) or, less commonly,
 * SQLITE_LOCKED (a table is locked within the same connection). Sequelize
 * wraps the former as a SequelizeTimeoutError and the latter as a generic
 * SequelizeDatabaseError, but in both cases the underlying driver error is
 * preserved on `.original`/`.parent`.
 */
function isRetryableLockError(error) {
  if (!error) {
    return false;
  }

  const candidates = [error, error.original, error.parent].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.code === "SQLITE_BUSY" || candidate.code === "SQLITE_LOCKED") {
      return true;
    }
  }

  if (error.name === "SequelizeTimeoutError") {
    return true;
  }

  if (
    typeof error.message === "string" &&
    /SQLITE_BUSY|SQLITE_LOCKED|database is locked|database table is locked/i.test(error.message)
  ) {
    return true;
  }

  return false;
}

function sleep(ms) {
  if (!ms || ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sequelize's SQLite connection manager hands out a brand-new native
 * connection for every transaction (keyed by the transaction's own uuid),
 * and a single shared connection for all non-transactional queries. Neither
 * path runs a `afterConnect` hook for this dialect, so the only reliable
 * place to tune *every* connection (shared or per-transaction) is to wrap
 * `getConnection` itself.
 */
function tuneConnectionForConcurrency(connection, busyTimeoutMs) {
  if (connection.__pochiTuned) {
    return Promise.resolve(connection);
  }
  connection.__pochiTuned = true;

  return new Promise((resolve, reject) => {
    // `exec` runs the statements without attempting to parse result rows,
    // which is what we want for PRAGMAs (journal_mode returns a row that we
    // don't care about here).
    connection.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}; PRAGMA journal_mode = WAL;`, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(connection);
    });
  });
}

function patchConnectionManagerForConcurrency(sequelize, busyTimeoutMs) {
  const connectionManager = sequelize.connectionManager;
  const originalGetConnection = connectionManager.getConnection.bind(connectionManager);

  connectionManager.getConnection = async function patchedGetConnection(options) {
    const connection = await originalGetConnection(options);
    await tuneConnectionForConcurrency(connection, busyTimeoutMs);
    return connection;
  };
}

/**
 * Connects to the SQLite file at `storagePath`, defines the models, creates
 * the schema if it is missing, and ensures a single counter row (id: 1)
 * exists initialized to 0. Safe to call multiple times against the same
 * file (e.g. once from `init` and again from `run`) - it will not reset an
 * already-initialized counter.
 */
async function createDatabase(storagePath) {
  if (!storagePath) {
    throw new TypeError("createDatabase: storagePath is required");
  }

  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: storagePath,
    logging: false,
    // Every transaction takes SQLite's write lock immediately (BEGIN
    // IMMEDIATE) instead of deferring it until the first write. This makes
    // lock contention happen predictably at transaction-start time, which
    // plays nicely with our own retry loop.
    transactionType: Transaction.TYPES.IMMEDIATE,
    // Disable Sequelize's own built-in query retry so that lock-contention
    // errors surface immediately to our own withRetry logic instead of
    // being silently retried in place underneath us.
    retry: { max: 0 },
  });

  patchConnectionManagerForConcurrency(sequelize, DEFAULT_BUSY_TIMEOUT_MS);

  const Counter = sequelize.define(
    "Counter",
    {
      total: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: "counters", timestamps: false }
  );

  const AuditLog = sequelize.define(
    "AuditLog",
    {
      observed: { type: DataTypes.INTEGER, allowNull: false },
      written: { type: DataTypes.INTEGER, allowNull: false },
    },
    { tableName: "audit_logs", timestamps: false }
  );

  // Creates tables only if they don't already exist; never drops data.
  await sequelize.sync();

  await Counter.findOrCreate({
    where: { id: COUNTER_ROW_ID },
    defaults: { id: COUNTER_ROW_ID, total: 0 },
  });

  return { sequelize, Counter, AuditLog };
}

/**
 * Runs `work` inside a transaction, retrying with exponential backoff (up
 * to `options.maxAttempts` total attempts) whenever the failure is a
 * transient SQLite lock-contention error. Any other error is rejected
 * immediately, without retrying. If every attempt is exhausted while still
 * hitting lock contention, rejects with an Error whose message contains the
 * substring "retries exhausted".
 */
async function withRetry(sequelize, work, options) {
  const { maxAttempts, baseDelayMs } = options || {};

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError("withRetry: options.maxAttempts must be a positive integer");
  }
  if (typeof baseDelayMs !== "number" || !Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new TypeError("withRetry: options.baseDelayMs must be a non-negative number");
  }

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await sequelize.transaction(async (transaction) => work(transaction));
    } catch (error) {
      lastError = error;

      if (!isRetryableLockError(error)) {
        throw error;
      }

      if (attempt === maxAttempts) {
        break;
      }

      const backoffMs = baseDelayMs * 2 ** (attempt - 1);
      await sleep(backoffMs);
    }
  }

  const exhaustedError = new Error(
    `withRetry: retries exhausted after ${maxAttempts} attempt(s) due to persistent lock contention` +
      (lastError ? `; last error: ${lastError.message}` : "")
  );
  exhaustedError.cause = lastError;
  throw exhaustedError;
}

/**
 * Performs one full increment: reads the current total, writes total + 1,
 * and appends exactly one audit row capturing the observed and written
 * values - all inside a single retried transaction. Resolves to the new
 * counter total.
 */
async function increment(db, options) {
  const { sequelize, Counter, AuditLog } = db;

  return withRetry(
    sequelize,
    async (transaction) => {
      const counter = await Counter.findByPk(COUNTER_ROW_ID, { transaction });
      if (!counter) {
        throw new Error("increment: counter row (id=1) does not exist; call createDatabase() first");
      }

      const observed = counter.total;
      const written = observed + 1;

      counter.total = written;
      await counter.save({ transaction });

      await AuditLog.create({ observed, written }, { transaction });

      return written;
    },
    options
  );
}

module.exports = {
  createDatabase,
  withRetry,
  increment,
};
