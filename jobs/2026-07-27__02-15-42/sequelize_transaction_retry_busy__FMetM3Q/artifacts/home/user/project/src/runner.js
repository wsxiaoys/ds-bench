// Set UV_THREADPOOL_SIZE to a large value to prevent thread pool starvation in SQLite under high concurrency.
process.env.UV_THREADPOOL_SIZE = 64;

const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

/**
 * Helper to determine if an error is a transient SQLite lock-contention error.
 */
function isTransientSqliteError(err) {
  if (!err) return false;
  
  // Check the error code (Sequelize or SQLite raw)
  const code = err.code || (err.parent && err.parent.code) || (err.original && err.original.code);
  if (code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED') {
    return true;
  }
  
  // Check the error message
  const message = err.message || '';
  if (
    message.includes('SQLITE_BUSY') || 
    message.includes('SQLITE_LOCKED') || 
    message.includes('database is locked') || 
    message.includes('busy')
  ) {
    return true;
  }
  
  return false;
}

/**
 * Connects to the SQLite file at storagePath, defines the models, creates the schema if missing,
 * ensures a single counter row exists initialized to 0, and resolves to an object { sequelize, Counter, AuditLog }.
 */
async function createDatabase(storagePath) {
  if (storagePath !== ':memory:') {
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: false,
    pool: {
      max: 20, // Allow up to 20 concurrent connections
      min: 1,
      idle: 10000,
      acquire: 30000
    }
  });

  // Intercept getConnection to apply connection-specific PRAGMAs on connection creation
  const originalGetConnection = sequelize.connectionManager.getConnection.bind(sequelize.connectionManager);
  sequelize.connectionManager.getConnection = async function(options) {
    const connection = await originalGetConnection(options);
    
    // Configure WAL mode, busy_timeout, and synchronous mode on every connection.
    // A smaller busy_timeout (e.g. 500ms) allows fast fail-fast so that Node.js
    // can handle retries asynchronously and prevent thread starvation.
    await new Promise((resolve, reject) => {
      connection.run('PRAGMA journal_mode=WAL;', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await new Promise((resolve, reject) => {
      connection.run('PRAGMA busy_timeout=500;', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await new Promise((resolve, reject) => {
      connection.run('PRAGMA synchronous=NORMAL;', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    return connection;
  };

  // Define Counter model
  const Counter = sequelize.define('Counter', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    total: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'counters',
    timestamps: false
  });

  // Define AuditLog model
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    observed: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    written: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'audit_logs',
    timestamps: false
  });

  // Enable WAL mode persistently on the database file
  await sequelize.query('PRAGMA journal_mode=WAL;');
  await sequelize.query('PRAGMA synchronous=NORMAL;');

  // Sync models
  await sequelize.sync();

  // Ensure a single counter row exists initialized to 0
  const [counter, created] = await Counter.findOrCreate({
    where: { id: 1 },
    defaults: { total: 0 }
  });

  if (!created && (counter.total === null || counter.total === undefined)) {
    counter.total = 0;
    await counter.save();
  }

  return { sequelize, Counter, AuditLog };
}

/**
 * Runs work inside a transaction and automatically retries it, using exponential backoff
 * with a capped maximum number of attempts, but only when the failure is a transient SQLite lock-contention error.
 */
async function withRetry(sequelize, work, options = {}) {
  const maxAttempts = typeof options.maxAttempts === 'number' ? options.maxAttempts : 5;
  const baseDelayMs = typeof options.baseDelayMs === 'number' ? options.baseDelayMs : 100;

  let attempt = 0;
  while (true) {
    attempt++;
    let transaction = null;
    try {
      // Use IMMEDIATE transactions to acquire a reserved lock at the start of the transaction.
      // This prevents snapshot conflicts and minimizes SQLITE_BUSY retries.
      transaction = await sequelize.transaction({
        type: Sequelize.Transaction.TYPES.IMMEDIATE
      });

      const result = await work(transaction);

      await transaction.commit();
      return result;
    } catch (err) {
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackErr) {
          // Ignore rollback errors if transaction is already completed/broken
        }
      }

      if (isTransientSqliteError(err)) {
        if (attempt >= maxAttempts) {
          throw new Error(`Transaction failed after ${attempt} attempts: retries exhausted. Original error: ${err.message}`);
        }

        // Exponential backoff: baseDelayMs * 2^(attempt - 1)
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        // Add random jitter to prevent thundering herd problem
        const jitter = delay * (0.5 + Math.random() * 0.5);
        await new Promise((resolve) => setTimeout(resolve, jitter));
      } else {
        // Immediate propagation for non-retryable errors
        throw err;
      }
    }
  }
}

/**
 * Performs one full increment through withRetry.
 */
async function increment(db, options = {}) {
  const { Counter, AuditLog, sequelize } = db;

  return await withRetry(sequelize, async (transaction) => {
    const counter = await Counter.findByPk(1, {
      transaction,
      rejectOnEmpty: true
    });

    const observed = counter.total;
    const written = observed + 1;

    counter.total = written;
    await counter.save({ transaction });

    await AuditLog.create({
      observed,
      written
    }, { transaction });

    return written;
  }, options);
}

module.exports = {
  createDatabase,
  withRetry,
  increment
};
