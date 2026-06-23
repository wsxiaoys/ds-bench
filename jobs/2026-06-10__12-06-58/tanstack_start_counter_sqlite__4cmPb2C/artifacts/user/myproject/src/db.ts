import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '..', 'counter.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.exec(`
      CREATE TABLE IF NOT EXISTS counter (
        id   INTEGER PRIMARY KEY CHECK (id = 1),
        count INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO counter (id, count) VALUES (1, 0);
    `)
  }
  return _db
}

export function getCount(): number {
  const db = getDb()
  const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number }
  return row.count
}

export function incrementCount(): number {
  const db = getDb()
  db.prepare('UPDATE counter SET count = count + 1 WHERE id = 1').run()
  const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number }
  return row.count
}
