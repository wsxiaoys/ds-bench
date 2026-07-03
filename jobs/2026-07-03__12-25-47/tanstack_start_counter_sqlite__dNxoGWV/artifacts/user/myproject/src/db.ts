import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const DB_DIR = path.resolve(process.cwd(), '.data')
const DB_PATH = process.env.COUNTER_DB_PATH ?? path.join(DB_DIR, 'counter.sqlite')

let dbInstance: Database.Database | null = null

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY CHECK (id = 1), value INTEGER NOT NULL)`)
  const row = db.prepare('SELECT value FROM counter WHERE id = 1').get() as { value: number } | undefined
  if (!row) {
    db.prepare('INSERT INTO counter (id, value) VALUES (1, 0)').run()
  }
  dbInstance = db
  return db
}

export function readCount(): number {
  const db = getDb()
  const row = db.prepare('SELECT value FROM counter WHERE id = 1').get() as { value: number } | undefined
  return row ? row.value : 0
}

export function incrementCount(): number {
  const db = getDb()
  const update = db.prepare('UPDATE counter SET value = value + 1 WHERE id = 1')
  update.run()
  const row = db.prepare('SELECT value FROM counter WHERE id = 1').get() as { value: number } | undefined
  return row ? row.value : 0
}
