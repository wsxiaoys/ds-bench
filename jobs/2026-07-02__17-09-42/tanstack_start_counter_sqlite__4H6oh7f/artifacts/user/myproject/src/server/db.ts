import Database from 'better-sqlite3'
import type { Database as BetterSqliteDatabase } from 'better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * Single source of truth for the SQLite connection used by the counter app.
 *
 * The database file lives on disk under <project>/data/counter.sqlite by
 * default. It can be overridden with the `COUNTER_DB_PATH` env var. Because the
 * file is on disk and the connection is opened in WAL mode, the value
 * survives a server restart.
 */

function resolveDbPath(): string {
  if (process.env.COUNTER_DB_PATH) {
    return process.env.COUNTER_DB_PATH
  }
  return resolve(process.cwd(), 'data', 'counter.sqlite')
}

let _db: BetterSqliteDatabase | null = null

function ensureDir(filePath: string): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * Idempotently initialize the SQLite database: open the connection, create
 * the schema if missing, and seed the singleton counter row so the very first
 * read already has a value to return.
 *
 * Safe to call multiple times - subsequent calls return the cached handle.
 */
export function initDb(): BetterSqliteDatabase {
  if (_db) return _db

  const dbPath = resolveDbPath()
  ensureDir(dbPath)

  const db = new Database(dbPath)
  // WAL is more crash/connection-resistant than the default rollback journal.
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS counter (
      id    INTEGER PRIMARY KEY CHECK (id = 1),
      count INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO counter (id, count) VALUES (1, 0);
  `)

  _db = db
  return db
}

/** Returns the singleton SQLite handle, initializing on first use. */
export function getDb(): BetterSqliteDatabase {
  return _db ?? initDb()
}

/** Reads the current counter value. */
export function readCount(): number {
  const db = getDb()
  const row = db
    .prepare('SELECT count FROM counter WHERE id = 1')
    .get() as { count: number } | undefined
  return row?.count ?? 0
}

/**
 * Atomically increments the counter and returns the new value. The UPDATE
 * and the follow-up SELECT run inside a single SQLite transaction so
 * concurrent callers cannot observe a stale value.
 */
export function incrementAndRead(): number {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('UPDATE counter SET count = count + 1 WHERE id = 1').run()
    const row = db
      .prepare('SELECT count FROM counter WHERE id = 1')
      .get() as { count: number }
    return row.count
  })
  return tx()
}
